CREATE TABLE `user_organization_contexts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_organization_contexts_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_organization_context_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `user_organization_contexts` ADD CONSTRAINT `user_organization_contexts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_organization_contexts` ADD CONSTRAINT `user_organization_contexts_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `user_organization_context_organization_idx` ON `user_organization_contexts` (`organizationId`);