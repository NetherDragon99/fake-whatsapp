/**
 * Finalize parsed messages with ownership, resolved media IDs, normalized reply quotes,
 * and reverse-chronological media priority order (newest -> oldest).
 */
export function finalizeParsedMessages(rawMessages = [], {
  chatId,
  meName = 'You',
  isSelfChat = false,
  mediaIdMap = null,
  normalizeFilename = (name) => name
} = {}) {
  const messageById = new Map();
  const orderedMediaIds = [];
  const seenMediaIds = new Set();

  const messages = rawMessages.map((m) => {
    const isOutgoing = Boolean(isSelfChat || (m.sender === meName));
    let linkedMediaId = null;
    let cleanMediaName = null;

    if (m.mediaName) {
      cleanMediaName = normalizeFilename(m.mediaName);
      if (mediaIdMap && mediaIdMap.has(cleanMediaName)) {
        linkedMediaId = mediaIdMap.get(cleanMediaName);
      }
    }

    const isVoice = m.mediaType === 'audio' || Boolean(cleanMediaName && /\.(opus|ogg|m4a|aac|mp3|wav)$/i.test(cleanMediaName));

    let replyTo = m.replyTo ? { ...m.replyTo } : null;
    if (replyTo) {
      const quotedMsg = replyTo.id ? messageById.get(replyTo.id) : null;
      if (!replyTo.mediaId && quotedMsg?.mediaId) {
        replyTo.mediaId = quotedMsg.mediaId;
      } else if (!replyTo.mediaId && replyTo.mediaName && mediaIdMap) {
        const cleanReplyMedia = normalizeFilename(replyTo.mediaName);
        if (mediaIdMap.has(cleanReplyMedia)) {
          replyTo.mediaId = mediaIdMap.get(cleanReplyMedia);
        }
      }
      const quotedSender = replyTo.sender || quotedMsg?.sender;
      if (quotedMsg ? quotedMsg.isOutgoing : (isSelfChat || quotedSender === meName)) {
        replyTo.sender = 'You';
      }
    }

    const finalMsg = {
      ...m,
      chatId,
      isOutgoing,
      mediaId: linkedMediaId,
      isVoiceNote: isVoice,
      duration: m.duration || 0,
      replyTo
    };
    if (finalMsg.id != null) {
      messageById.set(finalMsg.id, finalMsg);
    }
    return finalMsg;
  });

  for (let i = messages.length - 1; i >= 0; i--) {
    const mid = messages[i].mediaId;
    if (mid && !seenMediaIds.has(mid)) {
      seenMediaIds.add(mid);
      orderedMediaIds.push(mid);
    }
  }

  return { messages, orderedMediaIds };
}
