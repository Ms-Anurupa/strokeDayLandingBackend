// Renames videos uploaded before automatic naming to "<name><last 4 digits>.<ext>"
// and updates each participant's videoUrl.
//
// Preview only (changes nothing):  npm run rename-videos
// Apply the changes:               npm run rename-videos -- --apply
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/prisma.js";
import { VIDEO_DIRECTORY } from "../src/middleware/upload.js";
import { renameUploadedVideo, videoFileName } from "../src/controllers/participantController.js";

const apply = process.argv.includes("--apply");

// Already renamed: starts with a letter, ends with the last 4 phone digits,
// optional "-2" suffix. Old names ("1791783881801-128422525") start with digits.
function alreadyRenamed(filename, phone) {
  const stem = path.parse(filename).name;
  return new RegExp(`^[a-z][a-z0-9]*${String(phone).slice(-4)}(-[0-9]+)?$`).test(stem);
}

async function main() {
  const participants = await prisma.participant.findMany({
    where: { videoUrl: { startsWith: "/uploads/videos/" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true, phone: true, videoUrl: true },
  });

  let renamed = 0;
  let skipped = 0;

  for (const p of participants) {
    const filename = path.basename(p.videoUrl);
    const filePath = path.join(VIDEO_DIRECTORY, filename);

    if (alreadyRenamed(filename, p.phone)) {
      skipped += 1;
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`MISSING  ${filename} (${p.fullName}) - file not on server, skipped`);
      skipped += 1;
      continue;
    }

    if (!apply) {
      // Approximate in preview: two people with the same name and digits both show "-2" only on apply.
      console.log(`WOULD RENAME  ${filename}  ->  ${videoFileName(filename, VIDEO_DIRECTORY, p.fullName, p.phone)}`);
      renamed += 1;
      continue;
    }

    const file = { filename, path: filePath };
    renameUploadedVideo(file, p.fullName, p.phone);

    try {
      await prisma.participant.update({
        where: { id: p.id },
        data: { videoUrl: `/uploads/videos/${file.filename}` },
      });
      console.log(`RENAMED  ${filename}  ->  ${file.filename}`);
      renamed += 1;
    } catch (error) {
      // Put the file back so the database and disk stay in step.
      fs.renameSync(file.path, filePath);
      console.error(`FAILED   ${filename}: ${error.message}`);
    }
  }

  console.log(
    `\n${apply ? "Renamed" : "Would rename"}: ${renamed}, skipped: ${skipped}, total: ${participants.length}`
  );
  if (!apply && renamed) console.log("Run again with --apply to make these changes.");
}

main()
  .catch((error) => {
    console.error("RENAME FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
