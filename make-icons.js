import sharp from "sharp";
import fs from "fs";
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach((size) => {
  sharp("public/folder.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}x${size}.png`, (err) => {
      if (err) console.error(err);
    });
});
