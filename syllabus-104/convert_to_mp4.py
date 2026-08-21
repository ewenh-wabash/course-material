import subprocess
import sys
from pathlib import Path


def convert_mov_to_mp4(input_file):
    input_path = Path(input_file)
    # output_path = input_path.with_suffix(".mp4")
    output_path = "colz.mp4"

    command = [
        "ffmpeg",
        "-i",
        str(input_path),
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-preset",
        "medium",
        # "-an",  # remove audio
        "-movflags",
        "+faststart",
        "-y",
        str(output_path),
    ]

    subprocess.run(command, check=True)
    print(f"Created: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert.py input.mov")
        sys.exit(1)

    convert_mov_to_mp4(sys.argv[1])