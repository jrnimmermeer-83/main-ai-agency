CREATE TABLE `ai_configurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`scope` enum('customer','platform') NOT NULL,
	`provider` enum('openai','anthropic','google') NOT NULL DEFAULT 'openai',
	`model` varchar(160) NOT NULL DEFAULT 'gpt-5-mini',
	`systemPrompt` text NOT NULL,
	`guardrails` json NOT NULL,
	`updatedBy` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_configurations_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuration_organization_scope_unique` UNIQUE(`organizationId`,`scope`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`actorId` int NOT NULL,
	`changeRequestId` int,
	`action` varchar(120) NOT NULL,
	`subjectType` varchar(120) NOT NULL,
	`subjectId` int,
	`outcome` enum('success','denied','failed') NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `change_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeRequestId` int NOT NULL,
	`organizationId` int NOT NULL,
	`decidedBy` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `change_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`requestedBy` int NOT NULL,
	`source` enum('manual','agent') NOT NULL DEFAULT 'manual',
	`changeType` enum('safe','structural') NOT NULL,
	`targetScope` enum('customer','platform','provider') NOT NULL,
	`status` enum('requested','validated','pending_approval','approved','rejected','executing','verified','failed','rolled_back') NOT NULL DEFAULT 'requested',
	`title` varchar(200) NOT NULL,
	`rationale` text NOT NULL,
	`proposedValue` json NOT NULL,
	`validationResult` json NOT NULL,
	`requiresApproval` boolean NOT NULL DEFAULT false,
	`executedAt` timestamp,
	`verifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `change_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuration_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`changeRequestId` int NOT NULL,
	`configurationId` int NOT NULL,
	`snapshot` json NOT NULL,
	`createdBy` int NOT NULL,
	`restoredAt` timestamp,
	`restoredBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `configuration_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','operator','viewer') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_organization_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `provider_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`scope` enum('customer','platform') NOT NULL,
	`provider` enum('openai','anthropic','google') NOT NULL,
	`model` varchar(160) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_setting_organization_scope_unique` UNIQUE(`organizationId`,`scope`)
);
--> statement-breakpoint
ALTER TABLE `ai_configurations` ADD CONSTRAINT `ai_configurations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_configurations` ADD CONSTRAINT `ai_configurations_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_changeRequestId_change_requests_id_fk` FOREIGN KEY (`changeRequestId`) REFERENCES `change_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_approvals` ADD CONSTRAINT `change_approvals_changeRequestId_change_requests_id_fk` FOREIGN KEY (`changeRequestId`) REFERENCES `change_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_approvals` ADD CONSTRAINT `change_approvals_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_approvals` ADD CONSTRAINT `change_approvals_decidedBy_users_id_fk` FOREIGN KEY (`decidedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_requests` ADD CONSTRAINT `change_requests_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_requests` ADD CONSTRAINT `change_requests_requestedBy_users_id_fk` FOREIGN KEY (`requestedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_snapshots` ADD CONSTRAINT `configuration_snapshots_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_snapshots` ADD CONSTRAINT `configuration_snapshots_changeRequestId_change_requests_id_fk` FOREIGN KEY (`changeRequestId`) REFERENCES `change_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_snapshots` ADD CONSTRAINT `configuration_snapshots_configurationId_ai_configurations_id_fk` FOREIGN KEY (`configurationId`) REFERENCES `ai_configurations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_snapshots` ADD CONSTRAINT `configuration_snapshots_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_snapshots` ADD CONSTRAINT `configuration_snapshots_restoredBy_users_id_fk` FOREIGN KEY (`restoredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_memberships` ADD CONSTRAINT `organization_memberships_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organization_memberships` ADD CONSTRAINT `organization_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `organizations` ADD CONSTRAINT `organizations_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_settings` ADD CONSTRAINT `provider_settings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `provider_settings` ADD CONSTRAINT `provider_settings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_organization_created_idx` ON `audit_events` (`organizationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_change_idx` ON `audit_events` (`changeRequestId`);--> statement-breakpoint
CREATE INDEX `approval_change_idx` ON `change_approvals` (`changeRequestId`);--> statement-breakpoint
CREATE INDEX `change_organization_status_idx` ON `change_requests` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `change_requester_idx` ON `change_requests` (`requestedBy`);--> statement-breakpoint
CREATE INDEX `snapshot_organization_change_idx` ON `configuration_snapshots` (`organizationId`,`changeRequestId`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `organization_memberships` (`userId`);