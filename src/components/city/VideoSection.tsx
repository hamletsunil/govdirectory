import React from "react";
import type { VideoMeeting } from "@/components/city/types";
import { extractYouTubeId } from "@/components/city/helpers";

interface VideoSectionProps {
  primaryVideo: VideoMeeting;
  primaryVideoId: string;
  otherVideos: VideoMeeting[];
}

export function VideoSection({
  primaryVideo,
  primaryVideoId,
  otherVideos,
}: VideoSectionProps) {
  return (
    <section className="page-section section-alt" id="watch">
      <div className="section-inner">
        <span className="section-label">Watch</span>
        <h2 className="section-heading">Watch Your Government in Action</h2>

        <div className="video-embed">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${primaryVideoId}?rel=0&modestbranding=1`}
            title={primaryVideo.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="video-caption">
          <strong>{primaryVideo.title}</strong>
          {primaryVideo.date && (
            <span> &middot; {new Date(primaryVideo.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          )}
        </div>

        {otherVideos.length > 0 && (
          <div className="video-thumbnail-row">
            {otherVideos.map((v, i) => {
              const vid = v.video_url ? extractYouTubeId(v.video_url) : null;
              return (
                <a key={i} href={v.video_url || "#"} target="_blank" rel="noopener noreferrer" className="video-thumb">
                  {vid && (
                    <img
                      src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
                      alt={v.title}
                      className="video-thumb-img"
                      loading="lazy"
                    />
                  )}
                  <div className="video-thumb-info">
                    <div className="video-thumb-title">{v.title}</div>
                    {v.date && (
                      <div className="video-thumb-date">
                        {new Date(v.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
