// WhatsApp Chat Archive & Log Parser with Unicode Sanitization

export class WhatsAppParser {
  constructor() {
    this.dateFormat = 'DD/MM'; // Inferred: 'DD/MM' or 'MM/DD'
  }

  // Strip invisible Unicode formatting, BOM, ALM, directional markers, and normalize spaces
  sanitize(text) {
    if (!text) return '';
    return text
      .replace(/[\ufeff\u061c\u200b\u200e\u200f\u202a-\u202e\u2060\u2066-\u2069]/g, '') // BOM, ALM & LTR/RTL embedding markers
      .replace(/[\u202f\u00a0\u1680\u2000-\u200a\u205f\u3000]/g, ' ') // Non-breaking & narrow spaces
      .trim();
  }

  // Convert Eastern Arabic / Persian numerals to ASCII digits
  normalizeDigits(text) {
    if (!text) return '';
    return text
      .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  }

  // 1-to-1 normalization for matching header timestamps in Arabic & English exports
  normalizeForMatching(line) {
    if (!line) return '';
    return this.normalizeDigits(line)
      .replace(/\u060c/g, ',') // Arabic comma
      .replace(/[\u2013\u2014]/g, '-'); // En/Em dash
  }

  // Normalize filenames for matching inside ZIP archives
  normalizeFilename(filename) {
    if (!filename) return '';
    let name = this.sanitize(filename);
    // Remove enclosing brackets or quotes if present
    name = name.replace(/^[<"']|[>"']$/g, '');
    // Take basename only
    const parts = name.split(/[/\\]/);
    return parts[parts.length - 1].trim().toLowerCase();
  }

  // Infer whether archive uses DD/MM or MM/DD by scanning date lines across the archive
  inferDateFormat(rawLines) {
    let ddFound = false;
    let mmFound = false;

    const datePattern = /(?:^|\[)(\d{1,4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,4})/;

    for (let i = 0; i < rawLines.length; i++) {
      const line = this.normalizeForMatching(this.sanitize(rawLines[i]));
      const match = line.match(datePattern);
      if (match) {
        const first = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);
        const third = parseInt(match[3], 10);

        if (first >= 1000) {
          // YYYY/MM/DD vs YYYY/DD/MM
          if (third > 12 && second <= 12) {
            mmFound = true; // month second, day third
            break;
          } else if (second > 12 && third <= 12) {
            ddFound = true;
            break;
          }
        } else if (first > 12 && second <= 12) {
          ddFound = true;
          break;
        } else if (second > 12 && first <= 12) {
          mmFound = true;
          break;
        }
      }
    }

    if (mmFound && !ddFound) {
      this.dateFormat = 'MM/DD';
    } else {
      this.dateFormat = 'DD/MM'; // WhatsApp international default
    }

    return this.dateFormat;
  }

  // Convert parsed date + time strings into standard epoch timestamp
  parseTimestamp(dateStr, timeStr, fallbackTimestamp = null) {
    const fallback = fallbackTimestamp || Date.now();
    try {
      const dateParts = this.normalizeDigits(dateStr).split(/[\/\.\-]/).map((p) => parseInt(p, 10));
      let day, month, year;

      if (dateParts[0] >= 1000) {
        year = dateParts[0];
        month = dateParts[1];
        day = dateParts[2];
      } else {
        if (this.dateFormat === 'MM/DD') {
          month = dateParts[0];
          day = dateParts[1];
        } else {
          day = dateParts[0];
          month = dateParts[1];
        }
        year = dateParts[2];
        if (year < 100) {
          year += 2000;
        }
      }

      if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
        return fallback;
      }

      // Parse time (e.g. 10:45 am, 14:30, 7:15:30 PM, 11:20 ص, 09:15 مساءً)
      let cleanTime = this.normalizeDigits(this.sanitize(timeStr)).toLowerCase();
      let isPM = cleanTime.includes('pm') || cleanTime.includes('p.m.') || cleanTime.includes('مساء') || cleanTime.includes('م');
      let isAM = cleanTime.includes('am') || cleanTime.includes('a.m.') || cleanTime.includes('صباح') || cleanTime.includes('ص');

      // Strip words/letters from time digits
      cleanTime = cleanTime.replace(/[^\d:]/g, '');
      const timeParts = cleanTime.split(':').map((p) => parseInt(p, 10));

      let hours = isNaN(timeParts[0]) ? 0 : timeParts[0];
      const minutes = isNaN(timeParts[1]) ? 0 : timeParts[1];
      const seconds = isNaN(timeParts[2]) ? 0 : timeParts[2];

      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }

      const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
      const time = dateObj.getTime();
      return isNaN(time) ? fallback : time;
    } catch (e) {
      return fallback;
    }
  }

  // Categorize file extension into mediaType
  categorizeMedia(filename) {
    if (!filename) return null;
    const lower = filename.toLowerCase();
    if (/\.webp$/i.test(lower) || lower.includes('sticker') || lower.includes('stk-')) return 'sticker';
    if (/\.(jpg|jpeg|png|gif|heic|bmp)$/i.test(lower)) return 'image';
    if (/\.(mp4|3gp|mov|mkv|webm)$/i.test(lower)) return 'video';
    if (/\.(opus|ogg|mp3|m4a|aac|wav)$/i.test(lower)) return 'audio';
    if (/\.pdf$/i.test(lower)) return 'pdf';
    return 'document';
  }

  // Detect attachment markers in text
  detectAttachment(messageText) {
    if (!messageText) return { hasAttachment: false, filename: null, mediaType: null, caption: '' };

    // Patterns:
    // 1) <attached: filename>
    // 2) <ملف مرفق: filename>
    const attachedTagMatch = messageText.match(/<(?:attached|ملف مرفق):\s*([^>]+)>/i);

    if (attachedTagMatch) {
      const filename = this.sanitize(attachedTagMatch[1]);
      const cleanName = this.normalizeFilename(filename);
      const mediaType = this.categorizeMedia(cleanName);
      const caption = messageText.replace(attachedTagMatch[0], '').trim();
      return {
        hasAttachment: true,
        filename: cleanName,
        rawFilename: filename,
        mediaType,
        caption
      };
    }

    // Pattern 3 & 4:
    // filename (file attached)
    // filename (ملف مرفق)
    const lines = messageText.split('\n');
    let foundIndex = -1;
    let matchedFilename = null;

    for (let i = 0; i < lines.length; i++) {
      const lineClean = this.sanitize(lines[i]);
      const match = lineClean.match(/^([^\(\)]+?)\s*\((?:file attached|ملف مرفق)\)/i);
      if (match) {
        foundIndex = i;
        matchedFilename = this.sanitize(match[1]);
        break;
      }
    }

    if (matchedFilename) {
      const cleanName = this.normalizeFilename(matchedFilename);
      const mediaType = this.categorizeMedia(cleanName);
      lines.splice(foundIndex, 1);
      const caption = lines.join('\n').trim();
      return {
        hasAttachment: true,
        filename: cleanName,
        rawFilename: matchedFilename,
        mediaType,
        caption
      };
    }

    return { hasAttachment: false, filename: null, mediaType: null, caption: messageText };
  }

  // Detect voice / video call notices
  detectCall(text) {
    const lower = text.toLowerCase();
    
    const isMissed = lower.includes('missed voice call') ||
                     lower.includes('missed video call') ||
                     lower.includes('مكالمة صوتية فائتة') ||
                     lower.includes('مكالمة فيديو فائتة') ||
                     lower.includes('لم يتم الرد');

    const isVideo = lower.includes('video call') || lower.includes('مكالمة فيديو');
    const isVoice = lower.includes('voice call') || lower.includes('مكالمة صوتية');

    if (isVoice || isVideo || isMissed) {
      return {
        isCall: true,
        callType: isVideo ? 'video' : 'voice',
        isMissed,
        direction: isMissed ? 'missed' : 'incoming'
      };
    }

    return { isCall: false };
  }

  _resolveQuotedMessage(quotedSender, quotedSnippet, priorMessages) {
    const cleanSender = (quotedSender || '').trim().toLowerCase();
    const cleanSnippet = (quotedSnippet || '').trim().toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (let i = priorMessages.length - 1; i >= 0; i--) {
      const m = priorMessages[i];
      if (!m || m.isSystem) continue;

      const mSender = (m.sender || '').trim().toLowerCase();
      const senderMatches = !cleanSender || mSender === cleanSender;
      const mText = (m.text || '').trim().toLowerCase();
      const mMedia = (m.mediaName || '').trim().toLowerCase();

      let score = 0;
      if (cleanSnippet) {
        if (mText && mText === cleanSnippet) {
          score = senderMatches ? 100 : 80;
        } else if (mText && (mText.startsWith(cleanSnippet) || (mText.length >= 4 && cleanSnippet.startsWith(mText.slice(0, 40))))) {
          score = senderMatches ? 85 : 65;
        } else if (mText && cleanSnippet.length >= 4 && mText.includes(cleanSnippet)) {
          score = senderMatches ? 75 : 55;
        } else if (mMedia && (mMedia === cleanSnippet || cleanSnippet.includes(mMedia))) {
          score = senderMatches ? 80 : 60;
        } else if (m.mediaType && (
          (m.mediaType === 'image' && /^(photo|image|صورة|img)/i.test(cleanSnippet)) ||
          (m.mediaType === 'video' && /^(video|فيديو|vid)/i.test(cleanSnippet)) ||
          (m.mediaType === 'audio' && /^(voice|audio|ptt|صوت|رسالة صوتية)/i.test(cleanSnippet)) ||
          (m.mediaType === 'sticker' && /^(sticker|ملصق|ستيكر)/i.test(cleanSnippet)) ||
          ((m.mediaType === 'pdf' || m.mediaType === 'document') && /^(doc|pdf|file|مستند|ملف)/i.test(cleanSnippet))
        )) {
          score = senderMatches ? 60 : 40;
        }
      } else if (senderMatches) {
        score = 30;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
        if (bestScore === 100) break;
      }
    }

    return { bestMatch, bestScore };
  }

  _extractQuotedReply(msg, priorMessages, participantSet) {
    if (!msg || !msg.text || msg.isSystem) return;
    const text = msg.text;

    // 1. Explicit structured tags: <Reply: Sender | Snippet>, [Replying to Sender: "Snippet"], <رد على: ...>
    const tagMatch =
      text.match(/<(?:Reply|رد على):\s*([^|>]+?)\s*\|\s*([^>]+)>/i) ||
      text.match(/\[(?:Reply|Replying to|رد على|الرد على)\s*:?\s*([^\]|:"]+?)\s*(?:\||:)\s*"?([^\]"]+)"?\]/i);

    if (tagMatch) {
      const qSender = this.sanitize(tagMatch[1]);
      const qSnippet = this.sanitize(tagMatch[2]);
      const { bestMatch } = this._resolveQuotedMessage(qSender, qSnippet, priorMessages);
      msg.text = text.replace(tagMatch[0], '').trim();
      msg.replyTo = bestMatch
        ? {
            id: bestMatch.id,
            sender: bestMatch.sender || qSender || 'Contact',
            text: bestMatch.text || qSnippet || '',
            mediaType: bestMatch.mediaType || null,
            mediaName: bestMatch.mediaName || null,
            mediaId: bestMatch.mediaId || null
          }
        : {
            id: 'ext_' + (msg.seq ?? priorMessages.length) + '_' + Math.random().toString(36).substr(2, 5),
            sender: qSender || 'Contact',
            text: qSnippet || '',
            mediaType: null,
            mediaName: null,
            mediaId: null
          };
      return;
    }

    const singleTagMatch = text.match(/<(?:Reply|رد على):\s*([^>]+)>/i);
    if (singleTagMatch) {
      const qSnippet = this.sanitize(singleTagMatch[1]);
      const { bestMatch } = this._resolveQuotedMessage('', qSnippet, priorMessages);
      msg.text = text.replace(singleTagMatch[0], '').trim();
      msg.replyTo = bestMatch
        ? {
            id: bestMatch.id,
            sender: bestMatch.sender || 'Contact',
            text: bestMatch.text || qSnippet || '',
            mediaType: bestMatch.mediaType || null,
            mediaName: bestMatch.mediaName || null,
            mediaId: bestMatch.mediaId || null
          }
        : {
            id: 'ext_' + (msg.seq ?? priorMessages.length) + '_' + Math.random().toString(36).substr(2, 5),
            sender: 'Contact',
            text: qSnippet || '',
            mediaType: null,
            mediaName: null,
            mediaId: null
          };
      return;
    }

    // 2. Leading Markdown / WhatsApp mod quote lines: "> Sender: snippet" followed by actual reply body
    const lines = text.split('\n');
    let quoteEndIdx = 0;
    while (quoteEndIdx < lines.length && /^\s*(?:>|》)\s*/.test(lines[quoteEndIdx])) {
      quoteEndIdx++;
    }
    if (quoteEndIdx > 0 && quoteEndIdx < lines.length) {
      const remaining = lines.slice(quoteEndIdx).join('\n').trim();
      if (remaining) {
        const quotedLines = lines.slice(0, quoteEndIdx).map((l) => l.replace(/^\s*(?:>|》)\s*/, '').trim());
        let qSender = '';
        let qSnippet = quotedLines.join(' ').trim();
        const colonIdx = quotedLines[0].indexOf(':');
        if (colonIdx > 0 && colonIdx <= 60) {
          const candSender = quotedLines[0].slice(0, colonIdx).trim();
          const restFirst = quotedLines[0].slice(colonIdx + 1).trim();
          qSender = candSender;
          qSnippet = [restFirst, ...quotedLines.slice(1)].filter(Boolean).join(' ').trim();
        }
        const { bestMatch, bestScore } = this._resolveQuotedMessage(qSender, qSnippet, priorMessages);
        const knownSender = qSender && participantSet.has(qSender);
        if (bestMatch && bestScore >= 60) {
          msg.text = remaining;
          msg.replyTo = {
            id: bestMatch.id,
            sender: bestMatch.sender || qSender || 'Contact',
            text: bestMatch.text || qSnippet || '',
            mediaType: bestMatch.mediaType || null,
            mediaName: bestMatch.mediaName || null,
            mediaId: bestMatch.mediaId || null
          };
        } else if (knownSender && qSnippet) {
          msg.text = remaining;
          msg.replyTo = {
            id: 'ext_' + (msg.seq ?? priorMessages.length) + '_' + Math.random().toString(36).substr(2, 5),
            sender: qSender,
            text: qSnippet,
            mediaType: null,
            mediaName: null,
            mediaId: null
          };
        }
      }
    }
  }

  // Main chat parsing entry point
  parseChatLog(rawContent) {
    if (!rawContent) return { messages: [], participants: [], calls: [] };

    const rawLines = rawContent.split(/\r?\n/);
    this.inferDateFormat(rawLines);

    // Regex 1: Android format:
    // 12/05/2026, 10:14 pm - Sender Name: Message text
    const androidRegex = /^(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|صباح[\u064b\u0627]*|مساء[\u064b\u0627]*|[صم]\.?)?)\s*-\s*([^:]+):\s*([\s\S]*)$/i;

    // Regex 2: iOS format:
    // [12/05/2026, 10:14:22 PM] Sender Name: Message text
    const iosRegex = /^\[(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|صباح[\u064b\u0627]*|مساء[\u064b\u0627]*|[صم]\.?)?)\]\s*([^:]+):\s*([\s\S]*)$/i;

    // Regex 3: System line (e.g. End-to-end encryption notice or call line without sender colon):
    // 12/05/2026, 10:14 pm - Missed voice call
    const systemAndroidRegex = /^(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|صباح[\u064b\u0627]*|مساء[\u064b\u0627]*|[صم]\.?)?)\s*-\s*([^:]+)$/i;
    const systemIosRegex = /^\[(\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|صباح[\u064b\u0627]*|مساء[\u064b\u0627]*|[صم]\.?)?)\]\s*([^:]+)$/i;

    const messages = [];
    const participantSet = new Set();
    const calls = [];

    let currentMsg = null;
    let lastValidTimestamp = null;
    let msgSeq = 0;

    const extractMessageFlags = (rawText, existing = {}) => {
      let cleanText = rawText || '';
      let isEdited = Boolean(existing.isEdited);
      let isForwarded = Boolean(existing.isForwarded);
      let reaction = existing.reaction || null;

      if (/<This message was edited>|<تم تعديل هذه الرسالة>/i.test(cleanText)) {
        isEdited = true;
        cleanText = cleanText.replace(/<This message was edited>|<تم تعديل هذه الرسالة>/gi, '').trim();
      }
      if (/<Forwarded>|\[Forwarded\]|<محولة>|\[محولة\]/i.test(cleanText)) {
        isForwarded = true;
        cleanText = cleanText.replace(/<Forwarded>|\[Forwarded\]|<محولة>|\[محولة\]/gi, '').trim();
      }
      const reactMatch = cleanText.match(/<(?:Reaction|تفاعل):\s*([^>]+)>/i) ||
                         cleanText.match(/\[(?:Reaction|تفاعل):\s*([^\]]+)\]/i);
      if (reactMatch) {
        if (!reaction) reaction = reactMatch[1].trim();
        cleanText = cleanText.replace(reactMatch[0], '').trim();
      }
      return { cleanText, isEdited, isForwarded, reaction };
    };

    const finalizeMessage = (msg) => {
      if (!msg) return;
      if (msg.text) {
        const flags = extractMessageFlags(msg.text, msg);
        msg.text = flags.cleanText;
        msg.isEdited = flags.isEdited;
        msg.isForwarded = flags.isForwarded;
        msg.reaction = flags.reaction;
      }
      this._extractQuotedReply(msg, messages, participantSet);
      if (!msg.mediaName && msg.text) {
        const attach = this.detectAttachment(msg.text);
        if (attach.hasAttachment) {
          msg.mediaName = attach.filename;
          msg.mediaType = attach.mediaType;
          msg.text = attach.caption;
        }
      }
      if (typeof msg.text === 'string') {
        msg.text = msg.text.trim();
      }
      messages.push(msg);
    };

    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      const line = this.sanitize(rawLine);
      if (!line && !currentMsg) continue;

      const matchLine = this.normalizeForMatching(line);
      let match = matchLine.match(androidRegex) || matchLine.match(iosRegex);

      if (match) {
        // Commit previous message
        if (currentMsg) {
          finalizeMessage(currentMsg);
        }

        const dateStr = match[1];
        const timeStr = match[2];
        const sender = this.sanitize(match[3]);
        const rawContentLen = (match[4] || '').length;
        const content = rawContentLen > 0 ? line.slice(line.length - rawContentLen) : '';

        if (sender) {
          participantSet.add(sender);
        }

        let timestamp = this.parseTimestamp(dateStr, timeStr, lastValidTimestamp);
        if (lastValidTimestamp !== null && timestamp < lastValidTimestamp && (lastValidTimestamp - timestamp) <= 3600000) {
          // Guard against minor DST / NTP clock rollback within an hour inside a strictly ordered chat log
          timestamp = lastValidTimestamp;
        }
        lastValidTimestamp = timestamp;

        const seq = msgSeq++;
        const msgId = `msg_${String(timestamp).padStart(14, '0')}_${String(seq).padStart(7, '0')}_${Math.random().toString(36).substr(2, 5)}`;

        const firstFlags = extractMessageFlags(content);
        const attachment = this.detectAttachment(firstFlags.cleanText);
        let callInfo = this.detectCall(content);

        const isDeleted = content.includes('This message was deleted') ||
                          content.includes('You deleted this message') ||
                          content.includes('تم حذف هذه الرسالة');
        const isOmitted = content.includes('<Media omitted>') ||
                          content.includes('<الوسائط غير مدرجة>');

        const text = attachment.hasAttachment ? attachment.caption : firstFlags.cleanText;

        // WhatsApp export call detection: empty message line after timestamp & sender indicates a voice call
        if (!callInfo.isCall && !attachment.hasAttachment && !isDeleted && !isOmitted) {
          const stripped = (text || '').replace(/[\u200E\u200F\u202A-\u202E\uFEFF\s]/g, '');
          if (stripped.length === 0) {
            callInfo = {
              isCall: true,
              callType: 'voice',
              isMissed: false,
              direction: 'incoming'
            };
          }
        }

        currentMsg = {
          id: msgId,
          seq,
          timestamp,
          sender,
          isOutgoing: false, // will be assigned in perspective step
          text,
          mediaName: attachment.filename || null,
          mediaType: attachment.mediaType || null,
          mediaId: null, // linked during file matching
          replyTo: null,
          isDeleted,
          isEdited: firstFlags.isEdited,
          isOmitted,
          isForwarded: firstFlags.isForwarded,
          reaction: firstFlags.reaction,
          callInfo: callInfo.isCall ? callInfo : null
        };

        if (callInfo.isCall) {
          calls.push({
            id: `call_${String(timestamp).padStart(14, '0')}_${String(seq).padStart(7, '0')}_${Math.random().toString(36).substr(2, 5)}`,
            contactName: sender,
            timestamp,
            callType: callInfo.callType,
            direction: callInfo.direction,
            isMissed: callInfo.isMissed,
            messageId: currentMsg.id
          });
        }
      } else {
        // Check if it's a system notice / call line without colon
        let sysMatch = matchLine.match(systemAndroidRegex) || matchLine.match(systemIosRegex);
        if (sysMatch) {
          if (currentMsg) {
            finalizeMessage(currentMsg);
          }

          const dateStr = sysMatch[1];
          const timeStr = sysMatch[2];
          const sysTextLen = (sysMatch[3] || '').length;
          const sysText = sysTextLen > 0 ? this.sanitize(line.slice(line.length - sysTextLen)) : '';
          let timestamp = this.parseTimestamp(dateStr, timeStr, lastValidTimestamp);
          if (lastValidTimestamp !== null && timestamp < lastValidTimestamp && (lastValidTimestamp - timestamp) <= 3600000) {
            timestamp = lastValidTimestamp;
          }
          lastValidTimestamp = timestamp;

          const seq = msgSeq++;
          const sysId = `sys_${String(timestamp).padStart(14, '0')}_${String(seq).padStart(7, '0')}_${Math.random().toString(36).substr(2, 5)}`;
          const callInfo = this.detectCall(sysText);

          currentMsg = {
            id: sysId,
            seq,
            timestamp,
            sender: callInfo.isCall ? 'Call' : 'System',
            isSystem: !callInfo.isCall,
            isOutgoing: false,
            text: sysText,
            mediaName: null,
            mediaType: null,
            mediaId: null,
            replyTo: null,
            isDeleted: false,
            isEdited: false,
            callInfo: callInfo.isCall ? callInfo : null
          };

          if (callInfo.isCall) {
            calls.push({
              id: `call_${String(timestamp).padStart(14, '0')}_${String(seq).padStart(7, '0')}_${Math.random().toString(36).substr(2, 5)}`,
              contactName: 'Call',
              timestamp,
              callType: callInfo.callType,
              direction: callInfo.direction,
              isMissed: callInfo.isMissed,
              messageId: currentMsg.id
            });
          }
        } else if (currentMsg) {
          // Multi-line message continuation
          currentMsg.text = currentMsg.text ? `${currentMsg.text}\n${rawLine}` : rawLine;
        }
      }
    }

    if (currentMsg) {
      finalizeMessage(currentMsg);
    }

    let participants = Array.from(participantSet).filter(Boolean);
    if (participants.length === 0 && messages.length > 0) {
      participants = ['Contact', 'You'];
      for (const m of messages) {
        if (!m.sender || m.sender === 'System') {
          m.sender = 'Contact';
        }
      }
    }

    return {
      messages,
      participants,
      calls
    };
  }
}
