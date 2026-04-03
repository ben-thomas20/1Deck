const TURN_TIMEOUT = 30_000;     // 30 seconds
const WARNING_THRESHOLD = 10_000; // warn at 10 seconds remaining

export interface TurnTimerCallbacks {
  onWarning: (seatIndex: number, secondsRemaining: number) => void;
  onTimeout: (seatIndex: number) => void;
}

export class TurnTimer {
  private timeoutHandle: NodeJS.Timeout | null = null;
  private warningHandle: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private pausedTimeRemaining: number = 0;
  private currentSeatIndex: number = -1;
  private callbacks: TurnTimerCallbacks;

  constructor(callbacks: TurnTimerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Start a new turn timer for the given seat.
   */
  start(seatIndex: number): void {
    this.clear();
    this.currentSeatIndex = seatIndex;
    this.startTime = Date.now();
    this.pausedTimeRemaining = 0;

    this.scheduleTimers(TURN_TIMEOUT);
  }

  /**
   * Cancel the current timer (player acted in time).
   */
  clear(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    if (this.warningHandle) clearTimeout(this.warningHandle);
    this.timeoutHandle = null;
    this.warningHandle = null;
    this.currentSeatIndex = -1;
  }

  /**
   * Pause timer (player disconnected).
   */
  pause(): void {
    if (this.currentSeatIndex === -1) return;

    const elapsed = Date.now() - this.startTime;
    this.pausedTimeRemaining = Math.max(0, TURN_TIMEOUT - elapsed);

    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    if (this.warningHandle) clearTimeout(this.warningHandle);
    this.timeoutHandle = null;
    this.warningHandle = null;
  }

  /**
   * Resume timer (player reconnected).
   */
  resume(): void {
    if (this.currentSeatIndex === -1 || this.pausedTimeRemaining <= 0) return;

    this.startTime = Date.now();
    this.scheduleTimers(this.pausedTimeRemaining);
    this.pausedTimeRemaining = 0;
  }

  /**
   * Get remaining time in milliseconds.
   */
  getTimeRemaining(): number {
    if (this.currentSeatIndex === -1) return 0;
    if (this.pausedTimeRemaining > 0) return this.pausedTimeRemaining;
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, TURN_TIMEOUT - elapsed);
  }

  getCurrentSeat(): number {
    return this.currentSeatIndex;
  }

  private scheduleTimers(duration: number): void {
    // Warning timer
    const warningDelay = duration - WARNING_THRESHOLD;
    if (warningDelay > 0) {
      this.warningHandle = setTimeout(() => {
        this.callbacks.onWarning(
          this.currentSeatIndex,
          Math.ceil(WARNING_THRESHOLD / 1000)
        );
      }, warningDelay);
    }

    // Timeout timer
    this.timeoutHandle = setTimeout(() => {
      const seat = this.currentSeatIndex;
      this.clear();
      this.callbacks.onTimeout(seat);
    }, duration);
  }
}
