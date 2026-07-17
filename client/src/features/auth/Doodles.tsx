import styles from "./Doodles.module.css";

/**
 * Faint line-art illustrations scattered around the page edges.
 * Pure decoration — hidden from assistive tech and pointer events.
 */
export default function Doodles() {
  return (
    <div className={styles.layer} aria-hidden="true">
      {/* Sticky note with a curled corner */}
      <svg className={styles.note} viewBox="0 0 72 72" fill="none">
        <path d="M12 12 Q13 10 15 11 L58 10 Q61 10 60 13 L61 44 L46 61 L14 60 Q11 60 12 57 Z" />
        <path d="M46 61 L48 47 Q48 45 50 45 L61 44" />
        <path d="M21 26 Q32 24 44 26 Q48 26 50 25" />
        <path d="M21 36 Q30 34 41 36" />
      </svg>

      {/* Paper plane, echoing the logo */}
      <svg className={styles.plane} viewBox="0 0 90 60" fill="none">
        <path d="M8 34 L78 8 L52 52 L40 36 Z" />
        <path d="M40 36 L78 8" />
        <path d="M6 46 Q14 44 20 47" strokeDasharray="3 5" />
        <path d="M2 54 Q16 50 30 54" strokeDasharray="3 5" />
      </svg>

      {/* Pencil */}
      <svg className={styles.pencil} viewBox="0 0 72 72" fill="none">
        <path d="M18 54 L46 22 Q48 20 50 22 L56 28 Q58 30 56 32 L28 62 L16 65 Q14 66 15 64 Z" />
        <path d="M28 62 L18 54" />
        <path d="M42 27 L51 35" />
      </svg>

      {/* Sparkles */}
      <svg className={styles.sparkleA} viewBox="0 0 24 24" fill="none">
        <path d="M12 3 L12 21 M3 12 L21 12" />
      </svg>
      <svg className={styles.sparkleB} viewBox="0 0 24 24" fill="none">
        <path d="M12 4 L12 20 M4 12 L20 12" />
      </svg>
    </div>
  );
}
