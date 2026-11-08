// Ad policy + provider adapter. NO BANNERS — rewarded video is primary, interstitials are rare
// and only between levels. The default provider is a clearly labelled demo; see docs/DECISIONS.md ADR-005.

export const AD_POLICY = {
  interstitialEveryNClears: 4,
  minSessionMs: 180_000,
  minGapMs: 180_000,
};

/**
 * Provider contract (implement this to plug in a real network SDK):
 *   init(): Promise<void>
 *   isReady(kind: 'rewarded'|'interstitial'): boolean
 *   show(kind): Promise<{ completed: boolean }>   // completed=true only if the reward was earned
 */
export class DemoProvider {
  /** @param {(kind:string, seconds:number)=>Promise<boolean>} presenter UI that shows a demo ad overlay */
  constructor(presenter, seconds = 3) { this.presenter = presenter; this.seconds = seconds; this.name = 'demo'; }
  async init() {}
  isReady() { return !!this.presenter; }
  async show(kind) { return { completed: await this.presenter(kind, kind === 'rewarded' ? this.seconds : 2) }; }
}

/** No ads at all (soft-launch default until a real provider is wired in). Everything degrades gracefully. */
export class NullProvider {
  constructor() { this.name = 'off'; }
  async init() {}
  isReady() { return false; }
  async show() { return { completed: false }; }
}

export class AdManager {
  /**
   * @param {{provider, getFlags:()=>{noAds:boolean}, now?:()=>number, policy?:object, onWatched?:()=>void}} o
   */
  constructor({ provider, getFlags, now = Date.now, policy = AD_POLICY, onWatched }) {
    this.provider = provider; this.getFlags = getFlags; this.now = now; this.policy = policy; this.onWatched = onWatched;
    this.sessionStart = now();
    this.lastAdAt = -Infinity;
    this.clears = 0;
    this.busy = false;
  }

  get enabled() { return !this.getFlags().noAds; }
  rewardedAvailable() { return this.provider.isReady('rewarded') && !this.busy; }

  noteClear() { this.clears++; }

  canShowInterstitial() {
    if (!this.enabled || this.busy || !this.provider.isReady('interstitial')) return false;
    const t = this.now();
    return this.clears > 0
      && this.clears % this.policy.interstitialEveryNClears === 0
      && t - this.sessionStart >= this.policy.minSessionMs
      && t - this.lastAdAt >= this.policy.minGapMs;
  }

  /** Call between levels. Resolves true if an ad was shown. Never blocks gameplay on failure. */
  async maybeInterstitial() {
    if (!this.canShowInterstitial()) return false;
    return this._show('interstitial');
  }

  /** User-initiated only. Resolves true iff the reward was earned. */
  async rewarded() {
    if (!this.rewardedAvailable()) return false;
    return this._show('rewarded');
  }

  async _show(kind) {
    this.busy = true;
    try {
      const r = await this.provider.show(kind);
      this.lastAdAt = this.now();
      if (r.completed) this.onWatched?.(kind);
      return kind === 'rewarded' ? !!r.completed : true;
    } catch { return false; } finally { this.busy = false; }
  }
}
