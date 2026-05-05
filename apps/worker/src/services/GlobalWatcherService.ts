import { IRuleRepository } from '../interfaces/IRuleRepository';
import { IBirdeyeService } from '../interfaces/IBirdeyeService';
import { RuleEngine } from '../engine/RuleEngine';
import { UserModel, IRule, TriggerType, BirdeyeToken, BirdeyeSecurityData, BirdeyeMarketData } from '@chaintrigger/shared';
import { TriggerRegistry } from '../engine/strategies/TriggerRegistry';

interface ChainState {
  chain: string;
  intervalMs: number;
  timer: NodeJS.Timeout | null;
  rules: IRule[];
  userTierMap: Map<string, string>;
}

export class GlobalWatcherService {
  private chainStates: Map<string, ChainState> = new Map();
  private triggerRegistry: TriggerRegistry = new TriggerRegistry();

  private static readonly SYSTEM_RULES: Partial<IRule>[] = [
    {
      _id: 'sys-new-listing',
      userId: 'GLOBAL',
      name: 'Global New Listing Observer',
      triggerType: 'new_listing',
      chain: 'solana',
      conditions: [{ field: 'liquidity', operator: '>', value: 1000 }]
    },
    {
      _id: 'sys-pump-fun',
      userId: 'GLOBAL',
      name: 'Global Pump.fun Observer',
      triggerType: 'pump_fun_migration',
      chain: 'solana',
      conditions: []
    },
    {
      _id: 'sys-whale-radar',
      userId: 'GLOBAL',
      name: 'Global Whale Activity Observer',
      triggerType: 'whale_radar',
      chain: 'solana',
      conditions: [{ field: 'volume_24h', operator: '>', value: 100000 }]
    }
  ];

  constructor(
    private readonly ruleRepository: IRuleRepository,
    private readonly birdeyeService: IBirdeyeService,
    private readonly ruleEngine: RuleEngine
  ) {}

  async start() {
    console.log('🌐 Global Watcher Service starting...');
    
    // Initial sync
    await this.sync();

    // Periodically sync to handle new rules or tier changes
    setInterval(() => this.sync(), 30000); 
  }

  private async sync() {
    try {
      const dbRules = await this.ruleRepository.findAllActive();
      
      const allRules = [
        ...dbRules,
        ...GlobalWatcherService.SYSTEM_RULES as IRule[]
      ];

      // Fetch user tiers
      const userIds = [...new Set(dbRules.map((r: IRule) => r.userId))];
      const users = await UserModel.find({ walletAddress: { $in: userIds } }).select('walletAddress tier').lean().exec();
      const userTierMap = new Map<string, string>(users.map((u: any) => [u.walletAddress, u.tier]));

      // Group rules by chain
      const rulesByChain = new Map<string, IRule[]>();
      for (const rule of allRules) {
        if (!rulesByChain.has(rule.chain)) {
          rulesByChain.set(rule.chain, []);
        }
        rulesByChain.get(rule.chain)!.push(rule);
      }

      // Update or create watchers for each chain
      for (const [chain, rules] of rulesByChain) {
        const hasPro = rules.some((r: IRule) => userTierMap.get(r.userId) === 'pro' || r.userId === 'GLOBAL');
        const intervalMs = hasPro ? 3600000 : 14400000; // Pro: 1h, Free: 4h

        this.ensureWatcher(chain, intervalMs, rules, userTierMap);
      }

      // Cleanup watchers for chains with no active rules
      for (const chain of this.chainStates.keys()) {
        if (!rulesByChain.has(chain)) {
          this.stopWatcher(chain);
        }
      }
    } catch (error) {
      console.error('[GlobalWatcher] Sync Error:', error);
    }
  }

  private ensureWatcher(chain: string, intervalMs: number, rules: IRule[], userTierMap: Map<string, string>) {
    const currentState = this.chainStates.get(chain);

    if (currentState) {
      // Update rules and tier map anyway
      currentState.rules = rules;
      currentState.userTierMap = userTierMap;

      // If interval changed, restart
      if (currentState.intervalMs !== intervalMs) {
        console.log(`[GlobalWatcher] Updating interval for ${chain}: ${currentState.intervalMs}ms -> ${intervalMs}ms`);
        this.stopWatcher(chain);
        this.startWatcher(chain, intervalMs);
      }
    } else {
      console.log(`[GlobalWatcher] Starting new watcher for ${chain} at ${intervalMs}ms`);
      this.startWatcher(chain, intervalMs);
      const newState = this.chainStates.get(chain)!;
      newState.rules = rules;
      newState.userTierMap = userTierMap;
    }
  }

  private startWatcher(chain: string, intervalMs: number) {
    const state: ChainState = {
      chain,
      intervalMs,
      timer: null,
      rules: [],
      userTierMap: new Map()
    };

    state.timer = setInterval(() => this.tick(chain), intervalMs);
    this.chainStates.set(chain, state);
    
    // Immediate first tick
    this.tick(chain);
  }

  private stopWatcher(chain: string) {
    const state = this.chainStates.get(chain);
    if (state?.timer) {
      clearInterval(state.timer);
    }
    this.chainStates.delete(chain);
    console.log(`[GlobalWatcher] Stopped watcher for ${chain}`);
  }

  private lastRunMap: Map<string, number> = new Map();

  private async tick(chain: string) {
    const state = this.chainStates.get(chain);
    if (!state) return;

    const { rules, userTierMap } = state;
    if (rules.length === 0) return;

    // 1. Identify unique trigger types for this chain
    const triggerTypes = [...new Set(rules.map((r: IRule) => r.triggerType))];

    // 2. Fetch data ONCE per trigger type (Primary Polling)
    const fetchPromises = triggerTypes.map(async (type: TriggerType) => {
      try {
        const strategy = this.triggerRegistry.resolve(type);
        const tokens = await strategy.fetchAndFilter(this.birdeyeService, chain);
        return { type, tokens };
      } catch (error) {
        console.error(`[GlobalWatcher] Fetch error for ${chain}:${type}:`, error);
        return { type, tokens: [] };
      }
    });

    const results = await Promise.all(fetchPromises);
    const tokensByType = new Map<TriggerType, BirdeyeToken[]>(
      results.map((r: any) => [r.type, r.tokens])
    );

    // 2.5 Candidate Enrichment (The SCALE Optimization)
    // 20.000 kural olsa bile, sadece temel filtreyi geçenler için tek bir sefer veri çekiyoruz.
    const candidates = new Set<string>();
    for (const rule of rules) {
      const tokens = tokensByType.get(rule.triggerType) || [];
      for (const token of tokens) {
        if (this.ruleEngine.isCandidate(rule, token)) {
          candidates.add(token.address);
        }
      }
    }

    const enrichmentMap = new Map<string, { security: BirdeyeSecurityData, marketData?: BirdeyeMarketData }>();
    if (candidates.size > 0) {
      const candidatesArray = [...candidates];
      const batchSize = 5; // Process 5 tokens at a time to prevent rate limits
      
      for (let i = 0; i < candidatesArray.length; i += batchSize) {
        const batch = candidatesArray.slice(i, i + batchSize);
        await Promise.all(batch.map(async (address) => {
          try {
            const [security, marketData] = await Promise.all([
              this.birdeyeService.getTokenSecurity(address, chain),
              this.birdeyeService.getMarketData(address, chain)
            ]);
            enrichmentMap.set(address, { security, marketData });
          } catch (err) {
            console.error(`[GlobalWatcher] Enrichment failed for ${address}:`, err);
          }
        }));
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < candidatesArray.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // 3. Distribute tokens to rules locally
    const allMatches: any[] = [];
    const processingPromises: Promise<any[]>[] = [];

    for (const rule of rules) {
      const tokens = tokensByType.get(rule.triggerType) || [];
      if (tokens.length === 0) continue;

      const tier = (userTierMap.get(rule.userId) || (rule.userId === 'GLOBAL' ? 'pro' : 'free')) as string;
      
      // If it's a 1h tick (Pro speed) but rule is Free, skip if it's not the 4h mark
      if (tier === 'free' && state.intervalMs === 3600000) {
        const now = Date.now();
        const ruleKey = rule._id?.toString() || `${rule.userId}-${rule.name}`;
        const lastRun = this.lastRunMap.get(ruleKey) || 0;
        
        if (now - lastRun < 14000000) continue; // Skip until ~4 hours passed
        this.lastRunMap.set(ruleKey, now);
      }

      // Collect matches from this rule
      processingPromises.push(this.ruleEngine.processRuleBatch(rule, tokens, tier, enrichmentMap));
    }

    const resultsArray = await Promise.all(processingPromises);
    for (const matches of resultsArray) {
      allMatches.push(...matches);
    }

    // 4. Batch Persist & Dispatch
    if (allMatches.length > 0) {
      await this.ruleEngine.batchProcessResults(allMatches);
    }

    console.log(`[GlobalWatcher] Tick complete for ${chain}. Rules: ${rules.length}, Candidates: ${candidates.size}, Matches: ${allMatches.length}`);
  }

  async stopAll() {
    for (const chain of this.chainStates.keys()) {
      this.stopWatcher(chain);
    }
  }
}
