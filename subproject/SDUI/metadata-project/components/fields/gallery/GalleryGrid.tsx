'use client';

import React, { useMemo, useState } from "react";
import { readLabel, readMetaProps, type AnyRecord } from "@/components/fields/stats/statsUtils";

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

function readValue(item: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function formatDate(value: string) {
  if (!value) return "";
  return value.split("T")[0].replace(/-/g, ".");
}

function mediaKind(url: string) {
  if (!url) return "empty";
  return VIDEO_RE.test(url) ? "video" : "image";
}

export default function GalleryGrid({ id, meta, data }: any) {
  const props = readMetaProps(meta);
  const title = readLabel(meta, String(props.title ?? "Memory gallery"));
  const emptyText = String(props.emptyText ?? props.empty_text ?? "No memories yet");
  const items = useMemo(() => (Array.isArray(data) ? data as AnyRecord[] : []), [data]);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const active = selected ?? items[0] ?? null;
  const activeUrl = active ? readValue(active, ["resultUrl", "result_url", "mediaUrl", "media_url"]) : "";
  const activeKind = mediaKind(activeUrl);

  return (
    <section id={id} className="gallery-grid" aria-label={title}>
      <div className="gallery-grid__header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="gallery-grid__empty" role="status">{emptyText}</div>
      ) : (
        <>
          <div className="gallery-grid__items">
            {items.map((item, index) => {
              const url = readValue(item, ["thumbnailUrl", "thumbnail_url", "resultUrl", "result_url"]);
              const kind = mediaKind(url);
              const label = readValue(item, ["title", "route", "status"]) || `Memory ${index + 1}`;
              const status = readValue(item, ["status"]) || "READY";
              const isActive = active && String(active.id) === String(item.id);

              return (
                <button
                  key={String(item.id ?? index)}
                  type="button"
                  className={`gallery-grid__item${isActive ? " is-active" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  <span className="gallery-grid__thumb">
                    {kind === "video" ? (
                      <video src={url} muted playsInline preload="metadata" />
                    ) : kind === "image" ? (
                      <img src={url} alt="" loading="lazy" />
                    ) : (
                      <span>{status}</span>
                    )}
                  </span>
                  <span className="gallery-grid__meta">
                    <b>{label}</b>
                    <em>{formatDate(readValue(item, ["createdAt", "created_at"]))}</em>
                  </span>
                </button>
              );
            })}
          </div>

          {active && (
            <div className="gallery-grid__detail">
              <div className="gallery-grid__preview">
                {activeKind === "video" ? (
                  <video src={activeUrl} controls playsInline />
                ) : activeKind === "image" ? (
                  <img src={activeUrl} alt="" />
                ) : (
                  <div className="gallery-grid__pending">{readValue(active, ["status"]) || "Processing"}</div>
                )}
              </div>
              <div className="gallery-grid__detail-copy">
                <strong>{readValue(active, ["title", "route"]) || "Memory detail"}</strong>
                <span>{readValue(active, ["status"]) || "READY"}</span>
                {activeUrl && (
                  <a href={activeUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
