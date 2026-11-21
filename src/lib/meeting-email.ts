function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function renderMeetingEmail(subject: string, body: string) {
  const lines = body.split("\n").filter(Boolean);
  const content = lines
    .map((line) => {
      const split = line.indexOf(": ");
      if (split < 0)
        return (
          '<p style="margin:12px 0;color:#475569">' + escape(line) + "</p>"
        );
      const label = line.slice(0, split),
        value = line.slice(split + 2);
      const formatted =
        label === "Link" && /^https?:\/\//i.test(value)
          ? '<a href="' +
            escape(value) +
            '" style="color:#184ca6">Gabung meeting</a>'
          : escape(value);
      return (
        '<p style="margin:0;padding:10px 0;border-top:1px solid #dce3eb"><strong>' +
        escape(label) +
        "</strong><br>" +
        formatted +
        "</p>"
      );
    })
    .join("");
  return (
    '<html lang="id"><body style="background:#f4f6f9;padding:16px;font:15px/1.5 Arial,sans-serif;color:#172840"><div style="max-width:540px;margin:auto;background:white;padding:24px;border-top:3px solid #2458aa"><b style="color:#2458aa">Zekindo · Tender</b><h1 style="font-size:21px;line-height:1.3">' +
    escape(subject.split(" | ")[0]) +
    "</h1>" +
    content +
    "</div></body></html>"
  );
}
