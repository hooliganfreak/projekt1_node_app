-- DropForeignKey
ALTER TABLE "StickyNote" DROP CONSTRAINT "StickyNote_boardId_fkey";

-- AlterTable
ALTER TABLE "StickyNote" ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 110,
ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 250;

-- AddForeignKey
ALTER TABLE "StickyNote" ADD CONSTRAINT "StickyNote_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
