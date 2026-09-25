export const CDJ_LAUNCH_DATE = new Date('2026-10-01T00:00:00')

export function isCdjLive() {
  return new Date() >= CDJ_LAUNCH_DATE
}
