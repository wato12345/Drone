const LEGACY_USER_CUTOFF = new Date('2026-07-18T00:00:00')

export function isLegacyUser(createdAt: string): boolean {
  const registeredAt = new Date(createdAt)
  return !Number.isNaN(registeredAt.getTime()) && registeredAt < LEGACY_USER_CUTOFF
}

export const PROMO_ADS = [
  {
    title: '低空飞行保险限时特惠',
    body: '老用户专享：首年保费 8 折，覆盖城市航线全时段飞行风险。',
    cta: '立即了解',
  },
  {
    title: '无人机电池以旧换新',
    body: '注册于 2026-07-18 前的用户可享智能电池换新补贴，续航更持久。',
    cta: '查看活动',
  },
  {
    title: '航路规划 Pro 会员',
    body: '升级 Pro 解锁更多避障图层、历史航线与导出功能，限时 7 天试用。',
    cta: '免费试用',
  },
  {
    title: '城市航拍地图包',
    body: '高清三维建筑与禁飞区数据包上新，老用户下载立减 30 元。',
    cta: '去抢购',
  },
  {
    title: '飞行安全培训课程',
    body: '线上认证课程开放报名，完成学习可领取官方安全飞行徽章。',
    cta: '马上报名',
  },
] as const

export function pickRandomPromoAd() {
  return PROMO_ADS[Math.floor(Math.random() * PROMO_ADS.length)]
}
