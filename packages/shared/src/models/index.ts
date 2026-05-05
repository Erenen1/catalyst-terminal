/**
 * @file packages/shared/src/models/index.ts
 * @description Barrel export for all Mongoose models.
 */

export { RuleModel } from './Rule.model';
export type { IRuleDocument } from './Rule.model';

export { UserModel } from './User.model';
export type { IUserDocument } from './User.model';

export { AlertModel } from './Alert.model';
export type { IAlertDocument } from './Alert.model';

export { TrackedTokenModel } from './TrackedToken.model';
export type { ITrackedTokenDocument } from './TrackedToken.model';

export { LoopSubscriptionModel } from './LoopSubscription.model';
export type { ILoopSubscriptionDocument } from './LoopSubscription.model';
