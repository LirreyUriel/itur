/** Normalize an Israeli or international phone number to digits, preferring 972... */
export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length >= 9) {
    digits = `972${digits.slice(1)}`;
  }
  return digits;
}

export function phoneFromJid(jid: string | null | undefined) {
  if (!jid) return "";
  const user = jid.split("@")[0] ?? "";
  return normalizePhone(user.split(":")[0] ?? "");
}

export function isGroupJid(jid: string | null | undefined) {
  return Boolean(jid && (jid.endsWith("@g.us") || jid.endsWith("@newsletter")));
}

export function isStatusJid(jid: string | null | undefined) {
  return jid === "status@broadcast";
}

export function phonesMatch(a: string, b: string) {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTail = left.slice(-9);
  const rightTail = right.slice(-9);
  return leftTail.length >= 8 && leftTail === rightTail;
}

export function jidUser(jid: string | null | undefined) {
  if (!jid) return "";
  return (jid.split("@")[0] ?? "").split(":")[0] ?? "";
}

export function isOwnChat(opts: {
  remoteJid: string | null | undefined;
  myPhone: string;
  ownId?: string | null;
  ownLid?: string | null;
}) {
  const remote = opts.remoteJid;
  if (!remote || isGroupJid(remote) || isStatusJid(remote)) return false;
  const remoteUser = jidUser(remote);
  if (opts.ownId && remoteUser === jidUser(opts.ownId)) return true;
  if (opts.ownLid && remoteUser === jidUser(opts.ownLid)) return true;
  return phonesMatch(phoneFromJid(remote), opts.myPhone);
}

export function isAllowedSender(opts: {
  myPhone: string;
  remoteJid: string | null | undefined;
  participant: string | null | undefined;
  fromMe: boolean;
  ownId?: string | null;
  ownLid?: string | null;
}) {
  if (isStatusJid(opts.remoteJid) || isGroupJid(opts.remoteJid)) return false;

  // Linked-device "Message yourself" uses a LID that is not always sock.user.lid.
  if (opts.fromMe) return true;

  if (
    isOwnChat({
      remoteJid: opts.remoteJid,
      myPhone: opts.myPhone,
      ownId: opts.ownId,
      ownLid: opts.ownLid,
    })
  ) {
    return true;
  }

  const remote = phoneFromJid(opts.remoteJid);
  const participant = phoneFromJid(opts.participant);
  const sender = participant || remote;
  return phonesMatch(sender, opts.myPhone);
}
