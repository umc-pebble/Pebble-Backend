-- CreateTable
CREATE TABLE `FriendScheduleView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `viewerId` INTEGER NOT NULL,
    `targetUserId` INTEGER NOT NULL,
    `lastViewedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FriendScheduleView_targetUserId_idx`(`targetUserId`),
    UNIQUE INDEX `FriendScheduleView_viewerId_targetUserId_key`(`viewerId`, `targetUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FriendScheduleView` ADD CONSTRAINT `FriendScheduleView_viewerId_fkey` FOREIGN KEY (`viewerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FriendScheduleView` ADD CONSTRAINT `FriendScheduleView_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
