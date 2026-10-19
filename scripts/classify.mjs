// 分类规则：按 GitHub topics 精确命中（权重高）+ 简介关键词（权重低）
// 一个项目可以有多个分类，primary 是得分最高的那个。
// 想加分类：在 CATEGORIES 里加一项，再在 RULES 里加同名规则即可。

export const CATEGORIES = [
  { id: 'ai', name: 'AI / 大模型', icon: '🧠' },
  { id: 'agent', name: 'AI 智能体', icon: '🤖' },
  { id: 'devtool', name: '开发工具', icon: '🔧' },
  { id: 'frontend', name: '前端 / Web', icon: '🎨' },
  { id: 'backend', name: '后端 / 服务端', icon: '⚙️' },
  { id: 'mobile', name: '移动端', icon: '📱' },
  { id: 'data', name: '数据 / 数据库', icon: '🗄️' },
  { id: 'infra', name: '运维 / 云原生', icon: '☁️' },
  { id: 'selfhost', name: '自部署 / 家庭服务器', icon: '🏠' },
  { id: 'security', name: '安全 / 隐私', icon: '🛡️' },
  { id: 'media', name: '音视频 / 图像', icon: '🎬' },
  { id: 'game', name: '游戏 / 娱乐', icon: '🎮' },
  { id: 'learn', name: '学习 / 资源', icon: '📚' },
  { id: 'efficiency', name: '效率 / 桌面', icon: '⚡' },
  { id: 'system', name: '系统 / 基础软件', icon: '💻' },
  { id: 'network', name: '网络 / 代理', icon: '🌐' },
  { id: 'design', name: '设计 / 创意', icon: '🖌️' },
  { id: 'blockchain', name: '区块链 / Web3', icon: '⛓️' },
  { id: 'iot', name: '嵌入式 / IoT', icon: '🔌' },
  { id: 'other', name: '其他', icon: '📦' },
];

const RULES = {
  ai: {
    topics: [
      'llm', 'llms', 'gpt', 'gpt-4', 'chatgpt', 'large-language-model', 'llama', 'mistral',
      'machine-learning', 'deep-learning', 'neural-network', 'transformer', 'diffusion',
      'stable-diffusion', 'text-to-image', 'text-to-speech', 'llm-inference', 'inference',
      'fine-tuning', 'rag', 'retrieval-augmented-generation', 'embeddings', 'embedding',
      'huggingface', 'transformers', 'ollama', 'vllm', 'openai', 'anthropic', 'claude',
      'mcp', 'model-context-protocol', 'prompt-engineering', 'ai', 'artificial-intelligence',
    ],
    words: [
      /\bllms?\b/i, /\bgpt\b/i, /\bchatgpt\b/i, /\bdiffusion\b/i, /\btransformer/i,
      /\bmachine[- ]learning\b/i, /\bdeep[- ]learning\b/i, /\bfine[- ]?tun/i,
      /\binference\b/i, /\bembedding/i, /\bprompt\b/i, /\bopenai\b/i, /\bllama\b/i,
      /\bmodel context protocol\b/i, /\b大模型\b/, /\b人工智能\b/,
    ],
  },
  agent: {
    topics: ['ai-agent', 'ai-agents', 'agent', 'agents', 'agentic', 'autonomous-agents',
      'multi-agent', 'agent-framework', 'agentic-ai', 'autogpt', 'browser-use',
      'agent-skills', 'agent-skill', 'agent-harness', 'coding-agent', 'claude-code',
      'claude-skills', 'claude-code-plugin', 'codex', 'codex-skills', 'cursor-plugin',
      'skills', 'context-engineering'],
    words: [/\bagents?\b/i, /\bagentic\b/i, /\bagent skills?\b/i, /\bclaude code\b/i,
      /\bcodex\b/i, /\bcoding agent/i, /\bagent harness/i, /\bcursor plugin/i, /智能体/],
  },
  devtool: {
    topics: ['developer-tools', 'cli', 'command-line', 'devtools', 'code-editor', 'editor',
      'vscode', 'vscode-extension', 'neovim', 'vim', 'linter', 'formatter', 'debugger',
      'build-tool', 'package-manager', 'git', 'terminal', 'shell', 'dotfiles', 'sdk'],
    words: [/\bcli\b/i, /\btoolkit\b/i, /\bdeveloper tool/i, /\bcommand[- ]line\b/i,
      /\bterminal\b/i, /\beditor\b/i],
  },
  frontend: {
    topics: ['react', 'vue', 'svelte', 'angular', 'nextjs', 'nuxt', 'tailwindcss', 'css',
      'html', 'javascript', 'typescript', 'web', 'frontend', 'ui', 'ui-components',
      'component-library', 'design-system', 'vite', 'webpack', 'threejs', 'webgl', 'wasm',
      'cms', 'blog-engine', 'static-site-generator', 'hugo', 'jekyll'],
    words: [/\bfrontend\b/i, /\bfront-end\b/i, /\bweb framework\b/i, /\bui library\b/i,
      /\bcomponents?\b/i, /\bcss\b/i],
  },
  backend: {
    topics: ['api', 'rest-api', 'graphql', 'microservices', 'server', 'backend', 'http-server',
      'web-framework', 'grpc', 'websocket', 'django', 'flask', 'fastapi', 'spring-boot',
      'rails', 'laravel', 'express', 'nestjs'],
    words: [/\bbackend\b/i, /\bserver\b/i, /\bmicroservice/i, /\bapi\b/i, /\bframework\b/i],
  },
  mobile: {
    topics: ['android', 'ios', 'flutter', 'react-native', 'swiftui', 'uikit', 'kotlin',
      'mobile', 'mobile-app', 'jetpack-compose', 'app', 'xamarin', 'capacitor'],
    words: [/\bandroid\b/i, /\bios\b/i, /\bmobile\b/i, /\bflutter\b/i, /\bapp\b/i],
  },
  data: {
    topics: ['database', 'sql', 'nosql', 'postgresql', 'mysql', 'redis', 'mongodb', 'sqlite',
      'vector-database', 'olap', 'data-engineering', 'etl', 'apache-spark', 'analytics',
      'data-science', 'pandas', 'data-visualization', 'bi', 'streaming', 'kafka',
      'search-engine', 'graph-database'],
    words: [/\bdatabase\b/i, /\bdata\b/i, /\bsql\b/i, /\banalytics\b/i, /\betl\b/i],
  },
  infra: {
    topics: ['kubernetes', 'docker', 'devops', 'ci-cd', 'terraform', 'cloud', 'aws', 'azure',
      'gcp', 'serverless', 'observability', 'monitoring', 'logging', 'prometheus', 'grafana',
      'container', 'infrastructure-as-code', 'helm', 'nginx'],
    words: [/\bkubernetes\b/i, /\bdocker\b/i, /\bdevops\b/i, /\bdeploy/i, /\bcloud\b/i,
      /\bmonitoring\b/i],
  },
  selfhost: {
    topics: ['self-hosted', 'selfhosted', 'homelab', 'home-automation', 'nas', 'docker-compose',
      'personal-cloud', 'raspberry-pi', 'home-assistant', 'media-server'],
    words: [/\bself[- ]hosted\b/i, /\bselfhost/i, /\bhomelab\b/i, /\bhome server\b/i,
      /\b自部署\b/, /\b家庭服务器\b/],
  },
  security: {
    topics: ['security', 'cybersecurity', 'penetration-testing', 'pentest', 'cve',
      'vulnerability', 'malware', 'encryption', 'privacy', 'osint', 'reverse-engineering',
      'bug-bounty', 'antivirus', 'forensics', 'hacking', 'exploit'],
    words: [/\bsecurity\b/i, /\bprivacy\b/i, /\bencrypt/i, /\bvulnerab/i, /\bmalware\b/i,
      /\b安全\b/, /\b隐私\b/],
  },
  media: {
    topics: ['video', 'audio', 'ffmpeg', 'image', 'image-processing', 'ocr', 'tts',
      'text-to-speech', 'music', 'streaming', 'media', 'video-editing', 'subtitles',
      'anime', 'image-generation', 'computer-vision', 'camera', 'player', 'mpv',
      'iptv', 'm3u', 'animation', 'music-player', 'video-player'],
    words: [/\bvideo\b/i, /\baudio\b/i, /\bimage\b/i, /\bstream(ing)?\b/i, /\bsubtitle/i,
      /\bplayer\b/i, /\bocr\b/i, /\b音视频\b/, /\b图像\b/],
  },
  game: {
    topics: ['game', 'game-engine', 'gamedev', 'unity', 'godot', 'unreal-engine', 'minecraft',
      'emulator', 'gaming', 'game-development', 'pixel-art', 'steam', 'emulation'],
    words: [/\bgame\b/i, /\bgaming\b/i, /\bemulator\b/i, /\b游戏\b/, /\b模拟器\b/],
  },
  learn: {
    topics: ['awesome', 'awesome-list', 'learning', 'tutorial', 'course', 'roadmap',
      'interview', 'interview-questions', 'books', 'education', 'cheatsheet', 'guide',
      'documentation', 'resources', 'study', 'algorithm', 'leetcode', 'system-design'],
    words: [/\bawesome\b/i, /\btutorial\b/i, /\bcurated list\b/i, /\broadmap\b/i,
      /\blearn\b/i, /\bguide\b/i, /\b教程\b/, /\b学习\b/],
  },
  efficiency: {
    topics: ['productivity', 'note-taking', 'notes', 'markdown', 'wiki', 'knowledge-base',
      'bookmark', 'automation', 'workflow', 'rss', 'read-it-later', 'todo', 'calendar',
      'wallpaper', 'screenshot', 'launcher', 'window-manager', 'desktop'],
    words: [/\bproductivity\b/i, /\bnotes?\b/i, /\bautomation\b/i, /\bworkflow\b/i,
      /\b效率\b/],
  },
  system: {
    topics: ['linux', 'kernel', 'operating-system', 'os', 'compiler', 'programming-language',
      'language', 'runtime', 'virtual-machine', 'filesystem', 'boot', 'bootable-usb',
      'disk', 'activator', 'hwid', 'kms', 'uefi', 'emulation', 'sysadmin'],
    words: [/\bkernel\b/i, /\boperating system\b/i, /\bprogramming language\b/i,
      /\bcompiler\b/i, /\bbootable\b/i, /\bruntime\b/i, /\bactivator\b/i,
      /文件系统/, /操作系统/, /编程语言/],
  },
  network: {
    topics: ['proxy', 'vpn', 'socks5', 'shadowsocks', 'v2ray', 'xray', 'sing-box', 'frp',
      'tunnel', 'dns', 'p2p', 'torrent', 'wireguard', 'tailscale', 'network', 'nginx',
      'reverse-proxy', 'nat', 'zerotier'],
    words: [/\bproxy\b/i, /\bvpn\b/i, /\breverse proxy\b/i, /\bdns\b/i, /\bpeer-to-peer\b/i,
      /\btunnel\b/i, /代理/, /内网穿透/, /\bbit ?torrent\b/i],
  },
  design: {
    topics: ['design', 'ui-design', 'ux-design', 'graphic-design', 'photo-editing',
      'image-editing', 'vector', 'svg', 'diagram', 'figma', 'photo', 'drawing',
      'illustration', '3d', 'pixel-art', 'color-palette', 'typography'],
    words: [/\bphoto editor/i, /\bimage editor/i, /\bvector (art|graphics)/i, /\bdiagram\b/i,
      /illustrat/i, /\bdesign tool/i, /设计/, /\bwhiteboard\b/i],
  },
  blockchain: {
    topics: ['blockchain', 'ethereum', 'solana', 'bitcoin', 'crypto', 'cryptocurrency',
      'web3', 'defi', 'smart-contracts', 'nft', 'evm', 'solidity'],
    words: [/\bblockchain\b/i, /\bethereum\b/i, /\bcrypto/i, /\bweb3\b/i, /\bsolidity\b/i],
  },
  iot: {
    topics: ['iot', 'embedded', 'arduino', 'esp32', 'esp8266', 'firmware', 'raspberry-pi',
      'stm32', 'rtos', 'microcontroller', 'home-automation', 'robotics', 'drone'],
    words: [/\bembedded\b/i, /\bfirmware\b/i, /\barduino\b/i, /\besp32\b/i, /\biot\b/i,
      /\b嵌入式\b/],
  },
};

export function classify(repo, hint) {
  const topics = (repo.topics || []).map((t) => String(t).toLowerCase());
  const topicSet = new Set(topics);
  const text = `${repo.name || ''} ${repo.description || repo.desc || ''}`;

  const scores = new Map();
  const bump = (id, n) => scores.set(id, (scores.get(id) || 0) + n);

  for (const [id, rule] of Object.entries(RULES)) {
    for (const t of rule.topics) {
      if (topicSet.has(t)) bump(id, 3);
    }
    for (const re of rule.words) {
      if (re.test(text)) bump(id, 1.5);
    }
  }

  if (hint) bump(hint, 2);

  let entries = [...scores.entries()].filter(([, v]) => v >= 1.5);
  entries.sort((a, b) => b[1] - a[1]);
  // "agent" 是 ai 的子类，若同时命中，保留 agent 但不要把 ai 挤掉
  const ids = entries.slice(0, 3).map(([id]) => id);
  if (ids.length === 0) ids.push('other');

  return { categories: ids, primary: ids[0] };
}
