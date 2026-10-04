const taskInput = document.querySelector("#task-name");
const startButton = document.querySelector(".start-button");
const stopButton = document.querySelector(".stop-button");
const elapsedTime = document.querySelector(".elapsed-time");
const errorMessage = document.querySelector("#task-error");
const recordList = document.querySelector("#record-list");
const emptyRecords = document.querySelector("#empty-records");
const todayTotal = document.querySelector(".today-total");
const storageError = document.querySelector("#storage-error");

// この名前で、終了した記録の一覧をブラウザ内に保存します。
const STORAGE_KEY = "work-timer-records";
let canSaveRecords = true;

let startTime = null;
let timerId = null;
let startedTaskName = "";

// 今日以外の記録も、この配列に残して保存します。
let records = [];
let displayedDate = new Date();

function showStorageError(message) {
  storageError.textContent = message;
  storageError.hidden = false;
}

// 読み込んだデータが、記録として使える形かを確認します。
function isValidRecord(record) {
  return record !== null
    && typeof record === "object"
    && typeof record.id === "string"
    && record.id.trim() !== ""
    && typeof record.taskName === "string"
    && record.taskName.trim() !== ""
    && Number.isSafeInteger(record.startedAt)
    && !Number.isNaN(new Date(record.startedAt).getTime())
    && Number.isSafeInteger(record.endedAt)
    && !Number.isNaN(new Date(record.endedAt).getTime())
    && Number.isSafeInteger(record.durationMilliseconds)
    && record.durationMilliseconds >= 0;
}

function loadRecords() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData === null) {
      return;
    }

    // JSONという文字列の形式から、記録の配列に戻します。
    const savedRecords = JSON.parse(savedData);
    if (!Array.isArray(savedRecords) || !savedRecords.every(isValidRecord)) {
      throw new Error("保存データの形式が正しくありません");
    }

    const recordIds = new Set(savedRecords.map((record) => record.id));
    if (recordIds.size !== savedRecords.length) {
      throw new Error("記録のIDが重複しています");
    }

    savedRecords.sort((first, second) => second.endedAt - first.endedAt);
    for (const record of savedRecords) {
      records.push(record);
    }
  } catch (error) {
    // 読めなかったデータを、空の一覧で上書きしないようにします。
    canSaveRecords = false;
    showStorageError("保存した記録を読み込めませんでした。元の保存データを保護するため、このページでは保存や削除を行いません。新しい記録は再読み込みすると失われます。");
  }
}

function saveRecords(
  recordsToSave = records,
  failureMessage = "記録を保存できませんでした。記録は画面に残っていますが、保存できていない記録は再読み込みすると失われます。"
) {
  if (!canSaveRecords) {
    return false;
  }

  try {
    // 配列全体を保存するので、過去の記録も残ります。
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordsToSave));
    storageError.textContent = "";
    storageError.hidden = true;
    return true;
  } catch (error) {
    showStorageError(failureMessage);
    return false;
  }
}

function deleteRecord(recordId) {
  // 名前が同じでも、IDが一致する記録だけを対象にします。
  if (!records.some((record) => record.id === recordId)) {
    return;
  }

  if (!window.confirm("この記録を削除しますか？")) {
    return;
  }

  // 元の一覧を変更せず、選んだ記録を除いた新しい配列を作ります。
  const remainingRecords = records.filter((record) => record.id !== recordId);
  const saved = saveRecords(
    remainingRecords,
    "削除結果を保存できませんでした。記録は削除していません。元の記録と合計を維持しています。"
  );
  if (!saved) {
    return;
  }

  // 保存に成功した場合だけ、画面の一覧と合計を更新します。
  records = remainingRecords;
  renderRecords();
}

// 秒数を「時間:分:秒」の表示に変えます。
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function updateElapsedTime(currentTime = Date.now()) {
  // 更新回数ではなく、現在の時刻と開始時刻の差を使います。
  const elapsedMilliseconds = currentTime - startTime;
  const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000));
  elapsedTime.textContent = formatTime(totalSeconds);
}

// UTCではなく、この端末の年・月・日で同じ日かを調べます。
function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function renderRecords() {
  const today = new Date();
  displayedDate = today;

  const todayRecords = records.filter((record) => {
    return isSameDate(new Date(record.endedAt), today);
  });

  recordList.replaceChildren();
  emptyRecords.hidden = todayRecords.length > 0;
  let totalMilliseconds = 0;

  for (const record of todayRecords) {
    const item = document.createElement("li");
    item.className = "record-item";

    const name = document.createElement("p");
    name.className = "record-name";
    // 入力をHTMLとして解釈せず、そのまま文字として表示します。
    name.textContent = record.taskName;

    const start = document.createElement("p");
    start.className = "record-details";
    const startClock = new Date(record.startedAt).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    start.textContent = `開始時刻：${startClock}`;

    const duration = document.createElement("p");
    duration.className = "record-details";
    duration.textContent = `作業時間：${formatTime(Math.floor(record.durationMilliseconds / 1000))}`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `${record.taskName}の記録を削除`);
    deleteButton.addEventListener("click", () => {
      deleteRecord(record.id);
    });

    item.append(name, start, duration, deleteButton);
    recordList.append(item);
    totalMilliseconds += record.durationMilliseconds;
  }

  // ミリ秒で合計してから、表示する時だけ秒未満を切り捨てます。
  todayTotal.textContent = `今日の合計：${formatTime(Math.floor(totalMilliseconds / 1000))}`;
}

startButton.addEventListener("click", () => {
  // 計測中に別のタイマーが始まらないようにします。
  if (timerId !== null) {
    return;
  }

  if (taskInput.value.trim() === "") {
    errorMessage.textContent = "作業名を入力してください";
    errorMessage.hidden = false;
    taskInput.setAttribute("aria-invalid", "true");
    taskInput.focus();
    return;
  }

  errorMessage.textContent = "";
  errorMessage.hidden = true;
  taskInput.removeAttribute("aria-invalid");

  startTime = Date.now();
  startedTaskName = taskInput.value;
  updateElapsedTime();

  taskInput.disabled = true;
  startButton.disabled = true;
  stopButton.disabled = false;

  // 1秒ごとに画面の表示を更新します。
  timerId = setInterval(updateElapsedTime, 1000);
});

stopButton.addEventListener("click", () => {
  if (timerId === null) {
    return;
  }

  // 終了を押した時点の時間を表示してから、更新を止めます。
  const endTime = Date.now();
  updateElapsedTime(endTime);
  clearInterval(timerId);
  timerId = null;

  // 新しい記録を先頭に追加します。日時と作業時間の単位はミリ秒です。
  records.unshift({
    id: crypto.randomUUID(),
    taskName: startedTaskName,
    startedAt: startTime,
    endedAt: endTime,
    durationMilliseconds: Math.max(0, endTime - startTime),
  });
  renderRecords();

  taskInput.disabled = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  saveRecords();
});

loadRecords();
renderRecords();

// 画面を開いたまま日付が変わった時も、「今日」の一覧を更新します。
setInterval(() => {
  if (!isSameDate(displayedDate, new Date())) {
    renderRecords();
  }
}, 1000);
