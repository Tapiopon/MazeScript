import { world, system } from "@minecraft/server";

const maze_help = `help---1/1
create <width[x]> <height[z]> <ground block> <wall block> <generate speed>
`;

function generateMaze(width, height, sender) {
  let visitedCells = 0; // 訪問済みのセルの数
  const totalCells = ((width - 1) / 2) * ((height - 1) / 2); // 総セル数（壁を除く）

  const maze = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => "1")
  );
  const directions = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function isValid(x, y) {
    return x > 0 && y > 0 && x < width - 1 && y < height - 1;
  }

  function carve(x, y) {
    return new Promise((resolve) => {
      maze[y][x] = "0";
      shuffle(directions);
      visitedCells++;
      sender.runCommand(
        `title @s actionbar 迷路生成中: ${(
          (visitedCells / totalCells) *
          100
        ).toFixed(2)}%`
      );

      let i = 0; // directionsのインデックス

      function step() {
        if (i < directions.length) {
          const [dx, dy] = directions[i];
          const nx = x + dx,
            ny = y + dy;
          if (isValid(nx, ny) && maze[ny][nx] === "1") {
            maze[ny - dy / 2][nx - dx / 2] = "0"; // Remove the wall between
            carve(nx, ny).then(() => {
              i++;
              system.runTimeout(step, 0); // 次のdirectionへ
            });
          } else {
            i++;
            system.runTimeout(step, 0); // 次のdirectionへ
          }
        } else {
          resolve(); // 全てのdirectionを処理し終えた
        }
      }

      step();
    });
  }

  // Start from the top-right corner
  return carve(width - 2, 1).then(() => {
    // Set the start and end points
    maze[1][width - 2] = "2"; // Start
    maze[height - 2][1] = "3"; // Goal
    return maze;
  });
}

const renderMaze = (
  mazeMap,
  dimension,
  x,
  y,
  z,
  width,
  height,
  ground,
  wall,
  tick
) => {
  function runCommandloop(i, j) {
    dimension.runCommand(
      `fill ${x + i} ${y} ${z + j} ${x + i} ${y + 2} ${z + j} air`
    );
    if (mazeMap[j][i] == 0)
      dimension.runCommand(`setblock ${x + i} ${y} ${z + j} ${ground}`);
    if (mazeMap[j][i] == 1)
      dimension.runCommand(
        `fill ${x + i} ${y} ${z + j} ${x + i} ${y + 2} ${z + j} ${wall}`
      );
    if (mazeMap[j][i] == 2)
      dimension.runCommand(`setblock ${x + i} ${y} ${z + j} diamond_block`);
    if (mazeMap[j][i] == 3)
      dimension.runCommand(`setblock ${x + i} ${y} ${z + j} gold_block`);
    system.runTimeout(() => {
      j++;
      if (j >= height) {
        i++;
        j = 0;
      }
      if (i < width) {
        system.runTimeout(() => {
          runCommandloop(i, j);
        }, 0);
      }
    }, tick);
  }
  runCommandloop(0, 0);
};

world.afterEvents.chatSend.subscribe((e) => {
  if (e.message.startsWith("!maze")) {
    const mazecommand = e.message.split(" ");
    if (mazecommand[1] == "help") {
      e.sender.sendMessage(maze_help);
    }
    if (mazecommand[1] == "create") {
      if (!mazecommand[2] || !mazecommand[3])
        e.sender.sendMessage("ERR: コマンドの引数が足りません");
      if (
        mazecommand[2] < 3 ||
        mazecommand[2] % 2 === 0 ||
        mazecommand[3] < 3 ||
        mazecommand[3] % 2 === 0
      )
        e.sender.sendMessage("ERR: 幅は３以上かつ奇数である必要があります。");
      const x = Math.floor(e.sender.location.x);
      const y = Math.floor(e.sender.location.y);
      const z = Math.floor(e.sender.location.z);
      generateMaze(mazecommand[2], mazecommand[3], e.sender).then((mazeMap) => {
        renderMaze(
          mazeMap,
          world.getDimension(String(e.sender.dimension.id)),
          x,
          y,
          z,
          mazecommand[2],
          mazecommand[3],
          mazecommand[4] ? mazecommand[4] : "minecraft:white_wool",
          mazecommand[5] ? mazecommand[5] : "minecraft:black_wool",
          mazecommand[6] ? Number(mazecommand[6]) : 1
        );
      });
    }
  }
});
