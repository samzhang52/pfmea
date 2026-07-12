import { useCallback, useEffect } from "react";

export function useTableResize() {
  /* ── Column resize (React events on <th>) ── */
  const startColResize = useCallback((e) => {
    const th = e.currentTarget.closest("th");
    if (!th) return;
    e.preventDefault();

    const table = th.closest("table");
    const colIdx = Array.from(th.parentElement.children).indexOf(th);
    const startX = e.clientX;
    const startWidth = th.offsetWidth;

    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const w = Math.max(40, startWidth + delta);
      th.style.width = w + "px";
      th.style.minWidth = w + "px";
      th.style.maxWidth = w + "px";
      table.querySelectorAll("tr").forEach((row) => {
        const cell = row.children[colIdx];
        if (cell && cell !== th) {
          cell.style.width = w + "px";
          cell.style.minWidth = w + "px";
          cell.style.maxWidth = w + "px";
        }
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  /* ── Row resize (document-level mousedown delegation) ── */
  useEffect(() => {
    let drag = null;

    const onDown = (e) => {
      const handle = e.target.closest("[data-row-resize]");
      if (!handle) return;
      e.preventDefault();

      const td = handle.parentElement;
      if (!td || td.tagName !== "TD") return;
      const tr = td.parentElement;
      if (!tr || tr.tagName !== "TR") return;

      // Prevent content from pushing row back open during drag
      Array.from(tr.children).forEach((cell) => {
        cell.style.overflow = "hidden";
      });

      drag = { tr, startY: e.clientY, startHeight: tr.offsetHeight };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    };

    const onMove = (e) => {
      if (!drag) return;
      const h = Math.max(24, drag.startHeight + (e.clientY - drag.startY));
      drag.tr.style.height = h + "px";
      drag.tr.style.minHeight = h + "px";
    };

    const onUp = () => {
      if (drag) {
        Array.from(drag.tr.children).forEach((cell) => {
          cell.style.overflow = "";
        });
      }
      drag = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  return { startColResize };
}
