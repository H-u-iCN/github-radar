// 采集配置：想调整收录范围，只改这个文件
// 说明：Collecion = 一次 GitHub Search API 查询。page 数 * 100 = 该查询取多少条。

const DAY = 86400000;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);

export const CONFIG = {
  // 数据输出目录（相对仓库根目录）
  dataDir: 'data',
  historyDir: 'data/history',
  // 单个项目最低 star 门槛（防止把小仓库刷进榜）
  minStars: 300,
  // 总共最多保留多少项目（按热度截断）
  maxProjects: 900,
  // 历史快照保留天数
  historyKeepDays: 180,
  // 未认证 GitHub API 的搜索配额是 10 次/分钟，这里控制请求间隔
  searchDelayMs: Number(process.env.GH_SEARCH_DELAY_MS || 6500),

  collections: [
    // 近半年冒头的新项目：判断"最近在火什么"
    {
      id: 'rising',
      label: '新晋热门',
      q: `created:>=${iso(180 * DAY)} stars:>=1000`,
      sort: 'stars',
      pages: 2,
    },
    // 全站头部项目里仍在活跃更新的：基础盘
    {
      id: 'giants',
      label: '活跃巨头',
      q: `stars:>=20000 pushed:>=${iso(45 * DAY)}`,
      sort: 'stars',
      pages: 2,
    },
    // 近 45 天新冒头的小项目：挖「宝藏新仓库」用
    {
      id: 'newcomers',
      label: '45 天新星',
      q: `created:>=${iso(45 * DAY)} stars:>=150`,
      sort: 'stars',
      pages: 1,
    },
    // 小众但还在更新的：150 天内创建、150~3000 star，过滤掉巨头和死仓库
    {
      id: 'gems',
      label: '小众宝藏',
      q: `created:>=${iso(150 * DAY)} stars:150..3000 pushed:>=${iso(14 * DAY)}`,
      sort: 'stars',
      pages: 1,
    },
    // 分类补充：AI / 大模型
    {
      id: 'ai',
      label: 'AI 大模型',
      q: 'topic:llm stars:>=4000',
      sort: 'stars',
      pages: 1,
      hint: 'ai',
    },
    // AI 智能体
    {
      id: 'agents',
      label: 'AI 智能体',
      q: 'topic:ai-agents stars:>=1500',
      sort: 'stars',
      pages: 1,
      hint: 'agent',
    },
    // 自部署 / 家用服务器，非常实用的一类
    {
      id: 'selfhosted',
      label: '自部署',
      q: 'topic:self-hosted stars:>=5000',
      sort: 'stars',
      pages: 1,
      hint: 'selfhost',
    },
    // 开发工具
    {
      id: 'devtools',
      label: '开发工具',
      q: 'topic:developer-tools stars:>=4000',
      sort: 'stars',
      pages: 1,
      hint: 'devtool',
    },
    // 学习资源 / awesome 清单
    {
      id: 'awesome',
      label: '学习资源',
      q: 'topic:awesome stars:>=10000',
      sort: 'stars',
      pages: 1,
      hint: 'learn',
    },
    // 音视频 / 图像处理
    {
      id: 'media',
      label: '音视频 / 图像',
      q: 'topic:video stars:>=5000',
      sort: 'stars',
      pages: 1,
      hint: 'media',
    },
  ],

  // Trending 页面抓取（GitHub 官方没有 trending API，只能解析网页）
  trending: {
    enabled: true,
    urls: [
      'https://github.com/trending?since=daily',
      'https://github.com/trending?since=weekly',
    ],
  },

  // 语言统计时忽略的非语言值
  ignoreLanguages: ['', 'Unknown', 'HTML', 'Jupyter Notebook'],
};
