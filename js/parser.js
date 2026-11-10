// WhatsApp Chat Archive & Log Parser with Unicode Sanitization

export class WhatsAppParser {
  constructor() {
    this.dateFormat = 'DD/MM'; // Inferred: 'DD/MM' or 'MM/DD'
  }

  // Strip invisible Unicode formatting, directional markers, and normalize spaces
  sanitize(text) {
    if (!text) return '';
    return text
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '') // LTR/RTL embedding markers
      .replace(/[\u202f\u00a0\u1680\u2000-\u200a\u205f\u3000]/g, ' ') // Non-breaking & narrow spaces
      .trim();
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

  // Infer whether archive uses DD/MM or MM/DD by inspecting up to 200 date lines
  inferDateFormat(rawLines) {
    let ddFound = false;
    let mmFound = false;

    const datePattern = /(?:^|\[)(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/;

    for (let i = 0; i < Math.min(rawLines.length, 300); i++) {
      const line = this.sanitize(rawLines[i]);
      const match = line.match(datePattern);
      if (match) {
        const first = parseInt(match[1], 10);
        const second = parseInt(match[2], 10);

        if (first > 12 && second <= 12) {
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
  parseTimestamp(dateStr, timeStr) {
    try {
      const dateParts = dateStr.split(/[\/\.\-]/).map((p) => parseInt(p, 10));
      let day, month, year;

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

      // Parse time (e.g. 10:45 am, 14:30, 7:15:30 PM, 11:20 ص, 09:15 م)
      let cleanTime = this.sanitize(timeStr).toLowerCase();
      let isPM = cleanTime.includes('pm') || cleanTime.includes('p.m.') || cleanTime.includes('م');
      let isAM = cleanTime.includes('am') || cleanTime.includes('a.m.') || cleanTime.includes('ص');

      // Strip words/letters from time digits
      cleanTime = cleanTime.replace(/[^\d:]/g, '');
      const timeParts = cleanTime.split(':').map((p) => parseInt(p, 10));

      let hours = timeParts[0] || 0;
      const minutes = timeParts[1] || 0;
      const seconds = timeParts[2] || 0;

      if (isPM && hours < 12) {
        hours += 12;
      } else if (isAM && hours === 12) {
        hours = 0;
      }

      const dateObj = new Date(year, month - 1, day, hours, minutes, seconds);
      const time = dateObj.getTime();
      return isNaN(time) ? Date.now() : time;
    } catch (e) {
      return Date.now();
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

  // Main chat parsing entry point
  parseChatLog(rawContent) {
    if (!rawContent) return { messages: [], participants: [], calls: [] };

    const rawLines = rawContent.split(/\r?\n/);
    this.inferDateFormat(rawLines);

    // Regex 1: Android format:
    // 12/05/2026, 10:14 pm - Sender Name: Message text
    const androidRegex = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|ص|م)?)\s*-\s*([^:]+):\s*([\s\S]*)$/i;

    // Regex 2: iOS format:
    // [12/05/2026, 10:14:22 PM] Sender Name: Message text
    const iosRegex = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|ص|م)?)\]\s*([^:]+):\s*([\s\S]*)$/i;

    // Regex 3: System line (e.g. End-to-end encryption notice or call line without sender colon):
    // 12/05/2026, 10:14 pm - Missed voice call
    const systemAndroidRegex = /^(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|ص|م)?)\s*-\s*([^:]+)$/i;
    const systemIosRegex = /^\[(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?|ص|م)?)\]\s*([^:]+)$/i;

    const messages = [];
    const participantSet = new Set();
    const calls = [];

    let currentMsg = null;

    const finalizeMessage = (msg) => {
      if (!msg) return;
      if (!msg.mediaName && msg.text) {
        const attach = this.detectAttachment(msg.text);
        if (attach.hasAttachment) {
          msg.mediaName = attach.filename;
          msg.mediaType = attach.mediaType;
          msg.text = attach.caption;
        }
      }
      messages.push(msg);
    };

    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      const line = this.sanitize(rawLine);
      if (!line && !currentMsg) continue;

      let match = line.match(androidRegex) || line.match(iosRegex);

      if (match) {
        // Commit previous message
        if (currentMsg) {
          finalizeMessage(currentMsg);
        }

        const dateStr = match[1];
        const timeStr = match[2];
        const sender = this.sanitize(match[3]);
        const content = match[4] || '';

        participantSet.add(sender);

        const timestamp = this.parseTimestamp(dateStr, timeStr);
        const attachment = this.detectAttachment(content);
        const callInfo = this.detectCall(content);

        const isDeleted = content.includes('This message was deleted') ||
                          content.includes('You deleted this message') ||
                          content.includes('تم حذف هذه الرسالة');
        const isEdited = content.includes('<This message was edited>') ||
                         content.includes('<تم تعديل هذه الرسالة>');
        const isOmitted = content.includes('<Media omitted>') ||
                          content.includes('<الوسائط غير مدرجة>');

        let text = attachment.hasAttachment ? attachment.caption : content;
        if (isEdited) {
          text = text.replace(/<This message was edited>|<تم تعديل هذه الرسالة>/gi, '').trim();
        }

        currentMsg = {
          id: 'msg_' + timestamp + '_' + Math.random().toString(36).substr(2, 6),
          timestamp,
          sender,
          isOutgoing: false, // will be assigned in perspective step
          text,
          mediaName: attachment.filename || null,
          mediaType: attachment.mediaType || null,
          mediaId: null, // linked during file matching
          isDeleted,
          isEdited,
          isOmitted,
          isForwarded: false,
          reaction: null,
          callInfo: callInfo.isCall ? callInfo : null
        };

        if (callInfo.isCall) {
          calls.push({
            id: 'call_' + timestamp + '_' + Math.random().toString(36).substr(2, 6),
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
        let sysMatch = line.match(systemAndroidRegex) || line.match(systemIosRegex);
        if (sysMatch) {
          if (currentMsg) {
            finalizeMessage(currentMsg);
          }

          const dateStr = sysMatch[1];
          const timeStr = sysMatch[2];
          const sysText = this.sanitize(sysMatch[3]);
          const timestamp = this.parseTimestamp(dateStr, timeStr);
          const callInfo = this.detectCall(sysText);

          currentMsg = {
            id: 'sys_' + timestamp + '_' + Math.random().toString(36).substr(2, 6),
            timestamp,
            sender: 'System',
            isSystem: true,
            isOutgoing: false,
            text: sysText,
            mediaName: null,
            mediaType: null,
            mediaId: null,
            isDeleted: false,
            isEdited: false,
            callInfo: callInfo.isCall ? callInfo : null
          };

          if (callInfo.isCall) {
            calls.push({
              id: 'call_' + timestamp + '_' + Math.random().toString(36).substr(2, 6),
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
          currentMsg.text += '\n' + rawLine;
        }
      }
    }

    if (currentMsg) {
      finalizeMessage(currentMsg);
    }

    return {
      messages,
      participants: Array.from(participantSet),
      calls
    };
  }
}
