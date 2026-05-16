import { memo } from "react";

const RulesPanel = memo(() => (
  <div
    style={{
      background: "rgba(255,255,255,0.07)",
      borderRadius: 10,
      padding: 12,
      maxWidth: 480,
      marginBottom: 10,
      color: "#cbd5e1",
      fontSize: 11,
      lineHeight: 1.5,
      border: "1px solid rgba(255,255,255,0.1)",
    }}
  >
    <p style={{ margin: "0 0 5px" }}>
      <strong style={{ color: "#fff" }}>Active turn:</strong> Roll → ALL players may use white sum →
      only active player may also use white+color combo. Penalty if active player marks nothing.
    </p>
    <p style={{ margin: "0 0 5px" }}>
      <strong style={{ color: "#fff" }}>Passive:</strong> When another player rolls, you still get
      to use the white dice sum!
    </p>
    <p style={{ margin: "0 0 5px" }}>
      <strong style={{ color: "#fff" }}>Rules:</strong> Left→right only. 5+ marks to lock last
      number. Locking adds a bonus ✕ to scoring. Locks apply to all players. Game ends: 2 locked
      rows or any player at 4 penalties.
    </p>
    <p style={{ margin: 0 }}>
      <strong style={{ color: "#fff" }}>Scoring:</strong> 1✕=1, 2✕=3, 3✕=6, 4✕=10, 5✕=15, 6✕=21,
      7✕=28, 8✕=36, 9✕=45, 10✕=55, 11✕=66, 12✕=78
    </p>
  </div>
));

export default RulesPanel;
