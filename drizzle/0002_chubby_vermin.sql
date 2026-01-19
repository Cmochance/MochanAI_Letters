CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`novelId` int,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`category` enum('inspiration','character','worldview','plot','other') NOT NULL DEFAULT 'inspiration',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
