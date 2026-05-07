"use client";

import { X, Play } from "lucide-react";
import { useExemplar } from "./exemplar-context";
import styles from "./dashboard.module.css";

/**
 * Swaps in for the Sessions list on the right rail whenever the coaching
 * agent has surfaced an exemplar video. Embeds the YouTube video in an
 * iframe so the user can watch without leaving the dashboard.
 */
export default function VideoPanel() {
  const { video, closeVideo } = useExemplar();
  if (!video) return null;

  const embedUrl = `https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`;

  return (
    <div className={styles.videoPanel}>
      <header className={styles.videoPanelHeader}>
        <div className={styles.videoPanelHeaderLeft}>
          <div className={styles.videoPanelIcon}>
            <Play />
          </div>
          <div className={styles.videoPanelTitleWrap}>
            <span className={styles.videoPanelEyebrow}>Coach example</span>
            <h3 className={styles.videoPanelTitle} title={video.title}>
              {video.title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          className={styles.videoPanelClose}
          onClick={closeVideo}
          aria-label="Close example video"
          title="Close example video"
        >
          <X />
        </button>
      </header>

      <div className={styles.videoPanelFrameWrap}>
        <iframe
          key={video.youtubeId}
          src={embedUrl}
          title={video.title}
          className={styles.videoPanelFrame}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {(video.creator || video.why) && (
        <div className={styles.videoPanelNotes}>
          {video.creator && (
            <div className={styles.videoPanelCreator}>{video.creator}</div>
          )}
          {video.why && (
            <>
              <div className={styles.videoPanelNotesEyebrow}>Why it works</div>
              <p className={styles.videoPanelWhy}>{video.why}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
