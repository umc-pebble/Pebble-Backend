/*
  Warnings:

  - You are about to drop the column `gifUrl` on the `Report` table. All the data in the column will be lost.
  - Added the required column `reportImageUrl` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Report` DROP COLUMN `gifUrl`,
    ADD COLUMN `reportImageUrl` VARCHAR(500) NOT NULL;
