CREATE TABLE `website_chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`widgetId` int NOT NULL,
	`sessionKey` varchar(80) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`messageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `website_chat_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_session_widget_key_unique` UNIQUE(`widgetId`,`sessionKey`)
);
--> statement-breakpoint
CREATE TABLE `website_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`widgetId` int NOT NULL,
	`intent` enum('purchase','fleet','service','general') NOT NULL,
	`status` enum('new','in_progress','contacted','closed') NOT NULL DEFAULT 'new',
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(40),
	`message` text NOT NULL,
	`sourceUrl` varchar(1000),
	`consentAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `website_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_widgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`publicId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`allowedOrigins` json NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `website_widgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_widgets_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `website_chat_sessions` ADD CONSTRAINT `website_chat_sessions_widgetId_website_widgets_id_fk` FOREIGN KEY (`widgetId`) REFERENCES `website_widgets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_leads` ADD CONSTRAINT `website_leads_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_leads` ADD CONSTRAINT `website_leads_widgetId_website_widgets_id_fk` FOREIGN KEY (`widgetId`) REFERENCES `website_widgets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_widgets` ADD CONSTRAINT `website_widgets_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_widgets` ADD CONSTRAINT `website_widgets_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `lead_organization_status_idx` ON `website_leads` (`organizationId`,`status`);--> statement-breakpoint
CREATE INDEX `lead_widget_created_idx` ON `website_leads` (`widgetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `widget_organization_idx` ON `website_widgets` (`organizationId`);