const MS_PER_DAY = 86400000;

/**
 * Parse a `YYYY-MM-DD` date input strictly as local midnight.
 * Avoids `new Date('YYYY-MM-DD')` UTC parsing timezone shifts.
 */
export function parseLocalDateString(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const match = dateString.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Convert a Date or timestamp to an integer calendar-day index unaffected by DST.
 */
export function getLocalDayNumber(dateOrTimestamp) {
  const date = dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * Format a Date or timestamp as local `YYYY-MM-DD`.
 */
export function toLocalDateKey(dateOrTimestamp) {
  const date = dateOrTimestamp instanceof Date ? dateOrTimestamp : new Date(dateOrTimestamp);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date or `YYYY-MM-DD` string cleanly for Toast notifications.
 */
export function formatDateDisplay(dateOrKey) {
  const date = typeof dateOrKey === 'string' ? parseLocalDateString(dateOrKey) : dateOrKey;
  if (!date || Number.isNaN(date.getTime())) return String(dateOrKey || '');
  try {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (_) {
    return toLocalDateKey(date) || String(dateOrKey || '');
  }
}

/**
 * Return local `YYYY-MM-DD` of the newest message in `messages`, or null if empty.
 */
export function getLatestMessageDateKey(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  let latestTs = -Infinity;
  for (const m of messages) {
    if (m && typeof m.timestamp === 'number' && Number.isFinite(m.timestamp) && m.timestamp > latestTs) {
      latestTs = m.timestamp;
    }
  }
  return Number.isFinite(latestTs) ? toLocalDateKey(latestTs) : null;
}

/**
 * Find the first message on `dateString` (`YYYY-MM-DD`), or if none exists,
 * the first message on the nearest calendar day (preferring the newer day on an exact tie).
 */
export function findNearestDateMessage(messages = [], dateString) {
  const targetDate = parseLocalDateString(dateString);
  if (!targetDate || !Array.isArray(messages) || messages.length === 0) {
    return { targetMsg: null, matchedDateKey: null, isExactMatch: false };
  }

  const targetDayNum = getLocalDayNumber(targetDate);
  const targetKey = toLocalDateKey(targetDate);

  const firstByDay = new Map();
  for (const m of messages) {
    if (!m || m.timestamp == null) continue;
    const msgDate = new Date(m.timestamp);
    const dayNum = getLocalDayNumber(msgDate);
    if (dayNum === null) continue;

    const existing = firstByDay.get(dayNum);
    const isEarlier = !existing ||
      m.timestamp < existing.firstMsg.timestamp ||
      (m.timestamp === existing.firstMsg.timestamp && (m.seq ?? Infinity) < (existing.firstMsg.seq ?? Infinity));

    if (isEarlier) {
      firstByDay.set(dayNum, {
        firstMsg: m,
        dayNum,
        dateKey: toLocalDateKey(msgDate)
      });
    }
  }

  if (firstByDay.size === 0) {
    return { targetMsg: null, matchedDateKey: null, isExactMatch: false };
  }

  if (firstByDay.has(targetDayNum)) {
    const exact = firstByDay.get(targetDayNum);
    return {
      targetMsg: exact.firstMsg,
      matchedDateKey: exact.dateKey || targetKey,
      isExactMatch: true
    };
  }

  let bestEntry = null;
  let bestDiff = Infinity;

  for (const entry of firstByDay.values()) {
    const diff = Math.abs(entry.dayNum - targetDayNum);
    if (diff < bestDiff || (diff === bestDiff && bestEntry && entry.dayNum > bestEntry.dayNum)) {
      bestDiff = diff;
      bestEntry = entry;
    }
  }

  return bestEntry
    ? { targetMsg: bestEntry.firstMsg, matchedDateKey: bestEntry.dateKey, isExactMatch: false }
    : { targetMsg: null, matchedDateKey: null, isExactMatch: false };
}

/**
 * Open a native `<input type="date">` pre-positioned on `defaultDateKey` if empty.
 */
export function openDatePickerWithDefault(datePickerEl, defaultDateKey) {
  if (!datePickerEl) return;
  if (!datePickerEl.value && defaultDateKey) {
    datePickerEl.value = defaultDateKey;
  }
  if (typeof datePickerEl.showPicker === 'function') {
    try {
      datePickerEl.showPicker();
      return;
    } catch (_) {
      // Fallback to click() when showPicker fails due to platform restrictions
    }
  }
  datePickerEl.click();
}
