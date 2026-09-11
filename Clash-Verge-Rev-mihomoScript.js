// Clash Verge Rev 全局扩展脚本
// 作用：保留当前机场的 proxies / proxy-providers，统一替换为 MihomoProPlus 的代理组、规则与 DNS。
// 使用位置：订阅 -> 全局扩展脚本（Script）
//
// ==================== 2026-09-11 修订 ====================
//  A. FilterAL 补 (?i) 内联标志 —— 原为大小写敏感，节点名里小写的 channel/email/author
//     等公告类伪节点会漏过滤（同文件其余过滤器均带 (?i)）。
//  B. selectDC 改为显式去重，不再依赖「selectFB 末项恰好是直接连接」这一隐式前提
//     （验证：生成配置与改前逐字节一致）。
//  C. 移除 QUIC 嗅探 —— 同配置的 AND((DST-PORT,443),(NETWORK,UDP)),REJECT 已使嗅探结果
//     无处可用，仅白付握手解析开销（与 FlClash 版对齐）。
//  D. 补 global-client-fingerprint: chrome，与 FlClash 版对齐。
//  E. github rule-provider 拉取间隔 3600 → 86400，与其余 39 个 provider 一致。
//  F. nameserver-policy 补 fake-ip 生效条件说明（纯注释，无行为变化）。
//  G. FilterUS 补中文城市名（洛杉矶/纽约/达拉斯/圣何塞…），与 FlClash 版对齐：
//     纯城市命名的美国节点此前既进不了「美国策略」，也拿不到「全球手动」的美国排序。

function main(config, profileName) {
  // 不处理 MihomoProPlus 模板本身
  if (
    typeof profileName === "string" &&
    profileName.indexOf("MihomoProPlus") !== -1
  ) {
    return config;
  }

  const directProxyCount = Array.isArray(config.proxies)
    ? config.proxies.length
    : 0;

  const providers = config["proxy-providers"];
  const providerCount =
    providers && typeof providers === "object"
      ? Object.keys(providers).length
      : 0;

  // 没有节点时不处理
  if (directProxyCount === 0 && providerCount === 0) {
    return config;
  }

  // ==================== 基础配置 ====================

  config.mode = "rule";
  // IPv6 刻意关闭（与 Verge 应用层 IPv6 开关的关闭状态对齐）：
  // dns.ipv6=true 会让 DNS 返回 AAAA，而系统/TUN 无 IPv6 路由时，
  // 浏览器对 AAAA 的先试连接会超时回退（拖慢），兜底直连场景下
  // 更可能经物理网卡 IPv6 绕开 mihomo 造成 DNS/流量泄露。
  // 未来启用 IPv6 时需同时修改此处、下方 dns.ipv6 和 Verge 应用开关三处。
  config.ipv6 = false;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  // 统一 TLS Client Hello 指纹为 chrome，降低节点侧特征识别（与 FlClash 版对齐）
  config["global-client-fingerprint"] = "chrome";
  config["find-process-mode"] = "strict";
  config["keep-alive-interval"] = 15;
  config["keep-alive-idle"] = 600;

  // 不覆盖 Clash Verge 自己管理的端口、控制器、secret 等
  const oldTun =
    config.tun && typeof config.tun === "object"
      ? config.tun
      : {};

  config.tun = Object.assign({}, oldTun, {
    stack: "mixed",
    "dns-hijack": [
      "any:53",
      "tcp://any:53"
    ],
    "auto-route": true,
    // auto-redirect 仅 Linux 生效，Windows 下无意义，不设置。
    // strict-route 开启（2026-09-06 起）：TUN 模式下 Windows 多网卡存在
    // on-link DNS 逃逸（校园网/企业网网卡的 DNS 服务器同网段直连，绕过 TUN），
    // strict-route 通过防火墙规则强制全部流量进 TUN 堵住该口子。
    // 代价：WSL2/VMware/VirtualBox 等虚拟网络及局域网入站可能受影响，
    // 如相关功能异常需自行评估是否回退本项。
    "strict-route": true,
    "auto-detect-interface": true
  });

  // Windows 上 quic-go 的 GSO 有历史稳定性问题（影响 mihomo 自身 QUIC：
  // Hysteria2/TUIC 代理协议与 DoH h3），刻意保持禁用。
  // 注意：这与下方 AND 规则拦截的浏览器 QUIC(UDP 443) 是两回事，勿混淆。
  config.experimental = Object.assign(
    {},
    config.experimental || {},
    {
      "quic-go-disable-gso": true
    }
  );

  config.profile = Object.assign(
    {},
    config.profile || {},
    {
      "store-selected": true,
      "store-fake-ip": true
    }
  );

  // ==================== 流量嗅探 ====================
  // 仅嗅探 HTTP / TLS。QUIC 嗅探已移除（与 FlClash 版对齐）：本配置中
  // AND,((DST-PORT,443),(NETWORK,UDP)),REJECT 已把未命中前置直连规则的 UDP 443 全部拒绝，
  // 嗅探到的 QUIC 域名永远用不上，只白付一次握手解析开销。

  config.sniffer = {
    enable: true,

    sniff: {
      HTTP: {
        ports: [
          80,
          "8080-8880"
        ],
        "override-destination": true
      },

      TLS: {
        ports: [
          443,
          8443
        ]
      }
    },

    "skip-domain": [
      "Mijia Cloud",
      "+.push.apple.com"
    ]
  };

  // ==================== Hosts ====================

  config.hosts = Object.assign(
    {},
    config.hosts || {},
    {
      // ---- 以下为个人环境自定义项，非通用默认值 ----
      // 小米路由器后台域名指向内网（仅适用于 192.168.31.x 网段环境）
      "miwifi.com": "192.168.31.2",

      // WiFi Calling ePDG 固定 IP（英国运营商专属，IP 可能随运营商调整，需定期核对）
      "epdg.epc.mnc010.mcc234.pub.3gppnetwork.org": [
        "87.194.8.8",
        "87.194.88.8",
        "87.194.89.8",
        "87.194.9.8"
      ],

      "services.googleapis.cn": "services.googleapis.com",

      "cn.bing.com": "www4.bing.com"
    }
  );

  // ==================== DNS ====================

  config.dns = {
    enable: true,

    // 与全局 ipv6: false 对齐（见上方注释），杜绝 AAAA 泄露/超时路径
    ipv6: false,

    // DNS 缓存算法：arc 平均命中率优于默认 lru（需 mihomo 内核 ≥ 1.19.2）
    "cache-algorithm": "arc",

    "enhanced-mode": "fake-ip",

    "fake-ip-range": "198.18.0.1/16",

    "fake-ip-filter": [
      "+.lan",
      "+.local",

      "time.*.com",
      "time.*.gov",
      "ntp.*.com",
      "+.time.edu.cn",
      "+.ntp.org.cn",

      "+.market.xiaomi.com",
      "+.pub.3gppnetwork.org",
      "+.push.apple.com",
      "+.bing.com",

      // 游戏主机 NAT 穿透（仅共享网络给 Switch/Xbox/PS 时需要，无此场景可删除）
      "+.srv.nintendo.net",
      "+.xboxlive.com",
      "+.playstation.net",
      "stun.*.*",

      "+.cn",

      "rule-set:Direct",
      "rule-set:Private",
      "rule-set:China"
    ],

    "use-hosts": true,

    "respect-rules": true,

    "default-nameserver": [
      "tls://223.5.5.5",
      "tls://223.6.6.6"
    ],

    nameserver: [
      // 显式绑定「故障转移」组：DNS 出口与业务组选择解耦，
      // 业务组切直连时 DoH 查询链路不受影响（fail-closed：组挂则 DNS 挂）
      "https://cloudflare-dns.com/dns-query#故障转移",
      "https://dns.google/dns-query#故障转移"
    ],

    "direct-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],

    "proxy-server-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],

    // ⚠️ 生效条件：fake-ip 模式下，只有命中 fake-ip-filter（走真实解析）的域名才会查本表，
    // 未命中的域名直接返回 fake-ip、不进 Resolver.matchPolicy。因此下面「国内 DoH」两条
    // (+.cn / rule-set:Direct,Private,China) 是生效的；「国外 DoH」那条与广告 rcode 当前
    // 不会触发 —— nameserver 本身就是 CF/Google DoH，代理方向走代理端解析，结果一致，
    // 保留仅为将来关闭 fake-ip 时可用。
    "nameserver-policy": {
      "rule-set:Advertising,AWAvenueAds":
        "rcode://success",

      "+.cn": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],

      "rule-set:Direct,Private,China": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],

      "rule-set:Speedtest,Twitter,Telegram,SocialMedia,NewsMedia,Games,Crypto,Emby,Netflix,YouTube,Streaming,Apple,Google,Microsoft,Proxy": [
        "https://dns.google/dns-query#故障转移",
        "https://cloudflare-dns.com/dns-query#故障转移"
      ]
    }
  };

  // ==================== 节点筛选 ====================

  const FilterHK =
    "(?i)^(?=.*(港|🇭🇰|\\bHK\\b|Hong|HKG))(?!.*(排除1|排除2|5x)).*$";

  const FilterSG =
    "(?i)^(?=.*(坡|🇸🇬|\\bSG\\b|Sing|SIN|XSP))(?!.*(排除1|排除2|5x)).*$";

  const FilterJP =
    "(?i)^(?=.*(日|🇯🇵|樱花|🌸|东京|大阪|\\bJP\\b|Japan|NRT|HND|KIX|CTS|FUK))(?!.*(尼日利亚|尼日尔|排除2|5x)).*$";

  const FilterKR =
    "(?i)^(?=.*(韩|🇰🇷|韓|首尔|南朝鲜|\\bKR\\b|\\bKOR\\b|Korea))(?!.*(排除1|排除2|5x|Africa)).*$";

  // 保留单字「美」：机场存在名为「美」「美 01」的美国节点；
  // 含「美」字但非美国的地区（南美/中美洲/拉美等）用负向预查排除。
  // 中文城市名：纯城市命名的美国节点（如「洛杉矶 01」）此前两边都收不到；
  // 「达拉斯」「圣何塞」「波士顿」分别含「拉」「塞」「波」，会在 FilterEU 误命中（波/拉/塞是
  // 波兰/拉脱维亚/塞尔维亚的单字词），已在 EU 负向预查排除；「美娜多」（印尼 Manado）「北美」
  // 含「美」但非美国，在本过滤器负向预查排除。
  const FilterUS =
    "(?i)^(?=.*(美|🇺🇸|\\bUS\\b|\\bUSA\\b|JFK|SJC|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|洛杉矶|纽约|旧金山|西雅图|芝加哥|达拉斯|迈阿密|亚特兰大|波士顿|凤凰城|圣何塞|华盛顿))(?!.*(南美|中美洲|拉美|拉丁|阿根廷|巴西|美娜多|北美|Argentina|Brazil|Plus|Australia|5x)).*$";

  const FilterTW =
    "(?i)^(?=.*(台|🇹🇼|\\bTW\\b|Taiwan|TPE|TSA|KHH))(?!.*(排除1|排除2|5x)).*$";

  // 补充英文国名/城市名（Germany/Paris 等），避免纯英文命名的欧盟节点漏进「冷门自选」；
  // 同时排除含「拉」「比」「罗」等汉字但属拉美的地区名（圣保罗/哥伦比亚/委内瑞拉/巴拉圭）与俄罗斯。
  const FilterEU =
    "(?i)^(?=.*(奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉|立|卢|马耳他|荷|波|葡|罗|斯洛伐|斯洛文|西班牙|瑞|英|倫敦|伦敦|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|🇬🇧|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|LHR|LGW|\\bUK\\b|London|United\\s*Kingdom|\\bDE\\b|\\bFR\\b|\\bNL\\b|Germany|France|Paris|Berlin|Amsterdam|Zurich|Vienna|Madrid|Milan|Stockholm|Dublin|Warsaw|Lisbon|Prague|Copenhagen|Oslo|Helsinki))(?!.*(南美|中美洲|拉美|拉丁|阿根廷|巴西|圣保罗|哥伦比亚|委内瑞拉|巴拉圭|俄罗斯|达拉斯|圣何塞|波士顿|排除1|排除2|5x)).*$";

  const FilterMO =
    "(?i)^(?=.*(澳门|澳門|濠江|🇲🇴|\\bMO\\b|Macau|Macao|MFM|Taipa|氹仔|路氹|路环|Coloane|Cotai|MOG))(?!.*(排除1|排除2|5x)).*$";

  // 冷门自选：排除所有主流地区关键词。「美/拉/比/罗」等与拉美地名冲突的单字用断言限定，
  // 使 南美/中美洲/拉美/圣保罗/哥伦比亚/委内瑞拉/巴拉圭/俄罗斯 等冷门地区名
  // 不被「美/拉/比/罗」字连带排除，可正常进入冷门自选；
  // 美国/拉脱维亚/比利时/罗马尼亚 仍按原样被排除。
  const FilterOT =
    "(?i)^(?!.*(超时|重启|维护|暂停|失效|公告|套餐|到期|距离|剩余|天数|即将|重置|下次|官网|客服|网站|网址|过期|已用|联系|邮箱|工单|通知|失败|挂掉|未知地区|未知节点|DIRECT|直接连接|(?<!南)(?<!中)(?<!丁)(?<!拉)美|港|坡|台|狮城|獅城|日|樱花|🌸|东京|大阪|韩|奥|比(?=利)|保(?=加)|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉(?=脱)|立|卢|马耳他|荷|波|葡|罗(?=马)|斯洛伐|斯洛文|西班牙|瑞(?=士|典)|英|倫敦|伦敦|澳门|澳門|濠江|🇭🇰|🇹🇼|🇸🇬|🇯🇵|🇰🇷|🇺🇸|🇬🇧|🇲🇴|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|\\bHK\\b|\\bTW\\b|\\bSG\\b|\\bJP\\b|\\bKR\\b|\\bUS\\b|\\bGB\\b|\\bUK\\b|\\bMO\\b|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|HKG|TPE|TSA|KHH|SIN|XSP|NRT|HND|KIX|CTS|FUK|JFK|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|洛杉矶|纽约|旧金山|西雅图|芝加哥|达拉斯|迈阿密|亚特兰大|波士顿|凤凰城|圣何塞|华盛顿|LHR|LGW|London|United\\s*Kingdom|\\bDE\\b|\\bFR\\b|\\bNL\\b|Germany|France|Paris|Berlin|Amsterdam|Zurich|Vienna|Madrid|Milan|Stockholm|Dublin|Warsaw|Lisbon|Prague|Copenhagen|Oslo|Helsinki|MFM|MOG|Taipa|Coloane|Cotai))";

  // 机场信息节点统一排除规则（流量/到期/公告等），供各策略组 exclude-filter 复用
  const excludeInfoNodes =
    "(?i)流量|到期|套餐|公告|维护|官网|客服|重置|剩余|失效|暂停|过期|超时|重启";

  const FilterAL =
    "(?i)^(?!.*(DIRECT|直接连接|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别行政区|访问|支持|教程|关注|更新|作者|加入|超时|重启|维护|暂停|失效|公告|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))";

  // ==================== 策略组公共列表 ====================

  const selectFB = [
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧盟策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  // 以下列表均由 selectFB 派生，仅默认选中项（首项）不同；增删策略组时只需改上面
  const selectPY = ["默认代理", ...selectFB];

  // 显式去重，不再依赖「selectFB 末项恰好是直接连接」这一隐式前提
  const selectDC = ["直接连接", ...selectPY.filter(item => item !== "直接连接")];

  const selectUS = ["美国策略", ...selectPY.filter(item => item !== "美国策略")];

  const selectSG = ["狮城策略", ...selectPY.filter(item => item !== "狮城策略")];

  // ==================== 工具函数 ====================

  function selectGroup(
    name,
    proxiesList,
    icon
  ) {
    return {
      name: name,
      type: "select",
      proxies: proxiesList.slice(),
      icon: icon
    };
  }

  function regionSelect(
    name,
    filter,
    autoName,
    hashName,
    rrName,
    icon
  ) {
    return {
      name: name,
      type: "select",

      proxies: [
        autoName,
        hashName,
        rrName
      ],

      "include-all": true,
      "exclude-filter": excludeInfoNodes,

      filter: filter,

      "empty-fallback": "REJECT",

      icon: icon
    };
  }

  function urlTest(
    name,
    filter
  ) {
    return {
      name: name,

      type: "url-test",

      interval: 300,

      lazy: true,

      tolerance: 50,

      "expected-status": "204",

      url:
        "https://www.google.com/generate_204",

      hidden: true,

      "include-all": true,
      "exclude-filter": excludeInfoNodes,

      filter: filter,

      "empty-fallback": "REJECT",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Auto.png"
    };
  }

  function loadBalance(
    name,
    filter,
    strategy,
    icon
  ) {
    return {
      name: name,

      type: "load-balance",

      interval: 300,

      lazy: true,

      "expected-status": "204",

      url:
        "https://www.google.com/generate_204",

      strategy: strategy,

      hidden: true,

      "include-all": true,
      "exclude-filter": excludeInfoNodes,

      filter: filter,

      "empty-fallback": "REJECT",

      icon: icon
    };
  }

  // ==================== 全球手动节点排序 ====================
  // 仅影响“全球手动”代理组，不修改其他代理组和机场原始节点顺序。
  // 已知限制：此排序只覆盖 config.proxies（直接节点）；proxy-providers 的节点
  // 经 use: 由 mihomo 内核展开，JS 层无法干预其顺序，将按订阅原始顺序追加。

  function getGlobalManualProxies() {
    if (!Array.isArray(config.proxies)) {
      return [];
    }

    const excludeRegex =
      /(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|重启|维护|暂停|失效|公告|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)/i;

    function getPriority(name) {
      // 香港
      if (
        /(香港|🇭🇰|\bHK\b|Hong\s*Kong|HKG)/i.test(name)
      ) {
        return 10;
      }

      // 澳门
      if (
        /(澳门|澳門|濠江|🇲🇴|\bMO\b|Macau|Macao|MFM|Taipa|氹仔|路氹|路环|Coloane|Cotai|MOG)/i.test(name)
      ) {
        return 15;
      }

      // 台湾
      if (
        /(台湾|台灣|🇹🇼|\bTW\b|Taiwan|TPE|TSA|KHH)/i.test(name)
      ) {
        return 20;
      }

      // 新加坡
      if (
        /(新加坡|狮城|獅城|🇸🇬|\bSG\b|Singapore|SIN|XSP)/i.test(name)
      ) {
        return 30;
      }

      // 日本
      if (
        /(日本|🇯🇵|\bJP\b|Japan|樱花|🌸|东京|大阪|NRT|HND|KIX|CTS|FUK)/i.test(name)
      ) {
        return 40;
      }

      // 韩国
      if (
        /(韩国|韓國|首尔|首爾|🇰🇷|\bKR\b|\bKOR\b|Korea)/i.test(name)
      ) {
        return 50;
      }

      // 南美/中美洲/拉美：含「美」字但非美国，不参与美国排序
      if (/(南美|中美洲|拉美|拉丁|阿根廷|巴西|Argentina|Brazil)/i.test(name)) {
        return 1000;
      }

      // 美国
      if (
        /(美|🇺🇸|\bUS\b|\bUSA\b|United\s*States|LAX|SFO|JFK|SJC|SEA|IAD|ORD|ATL|DFW|MIA)/i.test(name)
      ) {
        return 60;
      }

      // 英国
      if (
        /(英国|英國|🇬🇧|\bUK\b|\bGB\b|United\s*Kingdom|London|LHR|LGW)/i.test(name)
      ) {
        return 70;
      }

      // 德国
      if (
        /(德国|德國|🇩🇪|\bDE\b|Germany|Frankfurt|FRA|MUC)/i.test(name)
      ) {
        return 80;
      }

      // 法国
      if (
        /(法国|法國|🇫🇷|\bFR\b|France|Paris|CDG)/i.test(name)
      ) {
        return 90;
      }

      // 其他节点
      return 1000;
    }

    return config.proxies
      .map((proxy, index) => ({
        name: proxy && proxy.name,
        index: index
      }))
      .filter(
        item =>
          item.name &&
          !excludeRegex.test(item.name)
      )
      .sort((a, b) => {
        const priorityDiff =
          getPriority(a.name) -
          getPriority(b.name);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return a.index - b.index;
      })
      .map(item => item.name);
  }

  const globalManualProxies =
    getGlobalManualProxies();

  const globalManualProviders =
    config["proxy-providers"] &&
    typeof config["proxy-providers"] === "object"
      ? Object.keys(config["proxy-providers"])
      : [];

  // ==================== 代理组 ====================

  config["proxy-groups"] = [
    {
      name: "全球手动",

      type: "select",

      proxies: globalManualProxies,

      use: globalManualProviders,

      filter: FilterAL,

      "empty-fallback": "REJECT",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Clubhouse.png"
    },

    selectGroup(
      "默认代理",
      selectFB,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Static.png"
    ),

    {
      name: "故障转移",

      type: "fallback",

      interval: 300,

      lazy: true,

      "expected-status": "204",

      url:
        "https://www.google.com/generate_204",

      proxies: [
        "香港策略",
        "狮城策略",
        "日本策略",
        "韩国策略",
        "美国策略",
        "台湾策略",
        "澳门策略",
        "欧盟策略",
        "全球手动",
        "冷门自选"
      ],

      // fail-closed：全部代理失效时不回落 DIRECT；空组（empty-fallback: REJECT）
      // 也拒绝连接而非直连——「节点全部失效」和「组里没有节点」都不泄露真实 IP
      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/ULB.png"
    },

    selectGroup(
      "国外流量",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Global.png"
    ),

    selectGroup(
      "国内流量",
      selectDC,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/China.png"
    ),

    selectGroup(
      "兜底流量",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Final.png"
    ),

    {
      name: "直接连接",

      type: "select",

      proxies: [
        "DIRECT"
      ],

      hidden: true,

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Direct.png"
    },

    {
      name: "网络测试",

      type: "select",

      proxies: selectPY.slice(),

      "include-all": true,
      "exclude-filter": excludeInfoNodes,

      filter: FilterAL,

      "empty-fallback": "REJECT",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Speedtest.png"
    },

    {
      name: "UKwifi",

      type: "select",

      proxies: [
        "DIRECT",
        "欧盟策略"
      ],

      icon:
        "https://www.giffgaff.design/iconography/icons/library/coverage-signal.svg"
    },

    {
      name: "抖快书定位",

      type: "select",

      proxies: [
        "直接连接",
        "香港策略",
        "台湾策略",
        "狮城策略",
        "日本策略",
        "韩国策略",
        "美国策略",
        "欧盟策略"
      ],

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Null_Nation.png"
    },

    selectGroup(
      "Emby服",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Emby.png"
    ),

    selectGroup(
      "油管视频",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/YouTube.png"
    ),

    selectGroup(
      "奈飞视频",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Netflix.png"
    ),

    selectGroup(
      "国际媒体",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/DomesticMedia.png"
    ),

    selectGroup(
      "新闻媒体",
      selectUS,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple_News.png"
    ),

    selectGroup(
      "电报消息",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Telegram_X.png"
    ),

    selectGroup(
      "推特社交",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/X.png"
    ),

    selectGroup(
      "社交平台",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/PBS.png"
    ),

    selectGroup(
      "人工智能",
      selectUS,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Bot.png"
    ),

    selectGroup(
      "谷歌AI",
      selectUS,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/AI.png"
    ),

    selectGroup(
      "货币平台",
      selectSG,
      "https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/Bitcloud.png"
    ),

    selectGroup(
      "游戏平台",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Game.png"
    ),

    selectGroup(
      "Github",
      selectPY,
      "https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/04ProxySoft/github(1).png"
    ),

    selectGroup(
      "微软服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Microsoft.png"
    ),

    selectGroup(
      "谷歌服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Google_Search.png"
    ),

    selectGroup(
      "苹果服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple.png"
    ),

    regionSelect(
      "香港策略",
      FilterHK,
      "香港自动",
      "香港均衡-散列",
      "香港均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Hong_Kong.png"
    ),

    regionSelect(
      "台湾策略",
      FilterTW,
      "台湾自动",
      "台湾均衡-散列",
      "台湾均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Taiwan.png"
    ),

    regionSelect(
      "狮城策略",
      FilterSG,
      "狮城自动",
      "狮城均衡-散列",
      "狮城均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Singapore.png"
    ),

    regionSelect(
      "日本策略",
      FilterJP,
      "日本自动",
      "日本均衡-散列",
      "日本均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Japan.png"
    ),

    regionSelect(
      "韩国策略",
      FilterKR,
      "韩国自动",
      "韩国均衡-散列",
      "韩国均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Korea.png"
    ),

    regionSelect(
      "美国策略",
      FilterUS,
      "美国自动",
      "美国均衡-散列",
      "美国均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/United_States.png"
    ),

    regionSelect(
      "欧盟策略",
      FilterEU,
      "欧盟自动",
      "欧盟均衡-散列",
      "欧盟均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/European_Union.png"
    ),

    regionSelect(
      "澳门策略",
      FilterMO,
      "澳门自动",
      "澳门均衡-散列",
      "澳门均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Macao.png"
    ),

    {
      name: "冷门自选",

      type: "select",

      "include-all": true,
      "exclude-filter": excludeInfoNodes,

      filter: FilterOT,

      "empty-fallback": "REJECT",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Europe_Map.png"
    },

    urlTest(
      "香港自动",
      FilterHK
    ),

    urlTest(
      "台湾自动",
      FilterTW
    ),

    urlTest(
      "狮城自动",
      FilterSG
    ),

    urlTest(
      "日本自动",
      FilterJP
    ),

    urlTest(
      "韩国自动",
      FilterKR
    ),

    urlTest(
      "美国自动",
      FilterUS
    ),

    urlTest(
      "欧盟自动",
      FilterEU
    ),

    urlTest(
      "澳门自动",
      FilterMO
    ),

    loadBalance(
      "香港均衡-散列",
      FilterHK,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "台湾均衡-散列",
      FilterTW,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "狮城均衡-散列",
      FilterSG,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "日本均衡-散列",
      FilterJP,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "韩国均衡-散列",
      FilterKR,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "美国均衡-散列",
      FilterUS,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "欧盟均衡-散列",
      FilterEU,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "澳门均衡-散列",
      FilterMO,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "香港均衡-轮询",
      FilterHK,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "台湾均衡-轮询",
      FilterTW,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "狮城均衡-轮询",
      FilterSG,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "日本均衡-轮询",
      FilterJP,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "韩国均衡-轮询",
      FilterKR,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "美国均衡-轮询",
      FilterUS,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "欧盟均衡-轮询",
      FilterEU,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "澳门均衡-轮询",
      FilterMO,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    )
  ];

  // ==================== 分流规则 ====================

  config.rules = [
    // 广告与跟踪
    "RULE-SET,Tracking,REJECT",
    "RULE-SET,AWAvenueAds,REJECT",
    "RULE-SET,Advertising,REJECT",

    // WiFi Calling
    "RULE-SET,ukwifi,UKwifi",

    // 抖音 / 快手 / 小红书定位
    "RULE-SET,LocationDKS,抖快书定位",

    // 私有 / 直连
    "RULE-SET,Private,直接连接",
    "RULE-SET,Direct,直接连接",
    "RULE-SET,XPTV,直接连接",
    "RULE-SET,Download,直接连接",
    "RULE-SET,AppleCN,直接连接",

    // 阻止 QUIC：拦下 UDP 443，浏览器自动回退 TCP(TLS)，保证嗅探/分流稳定，
    // 并规避部分节点 UDP 转发劣化。注意：本规则位于 China 列表之前，
    // 国内站点的 QUIC 同样会被拦（回退 TCP，通常无感知）；仅上方直连列表
    // （Private/Direct/XPTV/Download/AppleCN）命中者保留 QUIC。
    // 若想恢复国内 QUIC，可将本规则移至 RULE-SET,China 之后，但代价是
    // 所有在此之前的域名规则（Gemini/YouTube/Google 等）命中的代理流量也会恢复 QUIC。
    "AND,((DST-PORT,443),(NETWORK,UDP)),REJECT",

    // ==================== Gemini / NotebookLM ====================

    // 安卓 APP 按包名分流（mihomo 在 Android 上 PROCESS-NAME 匹配应用包名；
    // APP 对话流量走 www.google.com 等通用域名，域名规则拦不到，只能按包名识别。
    // 桌面端无此包名进程，规则不命中、无副作用）
    // Gemini APP
    "PROCESS-NAME,com.google.android.apps.bard,谷歌AI",
    // NotebookLM APP
    "PROCESS-NAME,com.google.android.apps.labs.language.tailwind,谷歌AI",

    // Gemini 网页 / 主域名
    "DOMAIN-SUFFIX,gemini.google.com,谷歌AI",
    "DOMAIN-SUFFIX,gemini.google,谷歌AI",
    "DOMAIN-SUFFIX,gemini.gstatic.com,谷歌AI",

    // Gemini APP 专属后端（这些是 Gemini 独有、非通用 AI 的 googleapis.com 子域，
    // 必须赶在 RULE-SET,AI 的宽后缀 .googleapis.com 之前精确命中，否则会被「人工智能」组抢走）
    "DOMAIN-SUFFIX,aida.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,aicode.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,geller-pa.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,robinfrontend-pa.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,cloudaicompanion.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,cloudcode-pa.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,notebooklm-pa.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,notebooklm.googleapis.com,谷歌AI",

    // Gemini API 开发者门户 / Jules（AI 编码代理）
    "DOMAIN,ai.google.dev,谷歌AI",
    "DOMAIN-SUFFIX,jules.google.com,谷歌AI",
    "DOMAIN-SUFFIX,jules.google,谷歌AI",

    // Gemini Notebook 当前正式入口
    "DOMAIN-SUFFIX,notebook.google.com,谷歌AI",

    // NotebookLM
    "DOMAIN-SUFFIX,notebooklm.google.com,谷歌AI",
    "DOMAIN-SUFFIX,notebooklm.google,谷歌AI",

    // NotebookLM / Gemini Notebook 企业版
    "DOMAIN-SUFFIX,notebooklm.cloud.google.com,谷歌AI",

    // Google AI Studio / Bard / MakerSuite / DeepMind / Labs
    "DOMAIN-SUFFIX,aistudio.google.com,谷歌AI",
    "DOMAIN-SUFFIX,bard.google.com,谷歌AI",
    "DOMAIN-SUFFIX,deepmind.google.com,谷歌AI",
    "DOMAIN-SUFFIX,deepmind.google,谷歌AI",
    "DOMAIN-SUFFIX,deepmind.com,谷歌AI",
    "DOMAIN-SUFFIX,generativeai.google,谷歌AI",
    "DOMAIN-SUFFIX,makersuite.google.com,谷歌AI",
    "DOMAIN,alkalimakersuite-pa.clients6.google.com,谷歌AI",
    "DOMAIN-SUFFIX,labs.google.com,谷歌AI",

    // Gemini API
    "DOMAIN-SUFFIX,generativelanguage.googleapis.com,谷歌AI",
    "DOMAIN,proactivebackend-pa.googleapis.com,谷歌AI",

    // 补齐 AI 列表中的真实 AI 接口（上游 AI 列表收录但上方窄规则未覆盖的）
    "DOMAIN-SUFFIX,aisandbox-pa.googleapis.com,谷歌AI",
    "DOMAIN,alkalicore-pa.clients6.google.com,谷歌AI",
    "DOMAIN,webchannel-alkalimakersuite-pa.clients6.google.com,谷歌AI",
    "DOMAIN-SUFFIX,antigravity-pa.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,antigravity.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,daily-cloudcode-pa.googleapis.com,谷歌AI",
    // 维护提示：未来新增的 *.googleapis.com AI 后端会被下方宽后缀规则接走，
    // 上线新 Google AI 服务时需在此手动补充对应域名。
    "DOMAIN-SUFFIX,aiplatform.googleapis.com,谷歌AI",

    // 上游 AI 列表含宽后缀 +.googleapis.com / +.googleusercontent.com / +.apis.google.com，
    // 会把 Gmail 页面翻译、邮件后端 API、附件头像等非 AI 流量抢进「谷歌AI」，
    // 与走「谷歌服务」的主站出口不一致导致卡顿。先于 AI 列表整体交还「谷歌服务」。
    "DOMAIN-SUFFIX,googleapis.com,谷歌服务",
    "DOMAIN-SUFFIX,googleusercontent.com,谷歌服务",
    "DOMAIN,apis.google.com,谷歌服务",

    // 其他 AI
    "RULE-SET,AI,人工智能",

    // 测速
    "DOMAIN-KEYWORD,speedtest,网络测试",
    "RULE-SET,Speedtest,网络测试",

    // 社交
    "RULE-SET,Twitter,推特社交",
    "RULE-SET,Telegram,电报消息",
    "RULE-SET,SocialMedia,社交平台",

    // 新闻
    "RULE-SET,NewsMedia,新闻媒体",

    // 游戏
    "DOMAIN-SUFFIX,steamserver.net,直接连接",
    "RULE-SET,Games,游戏平台",

    // 加密货币
    "RULE-SET,Crypto,货币平台",

    // Emby
    "RULE-SET,Emby,Emby服",

    // Netflix
    "RULE-SET,Netflix,奈飞视频",

    // YouTube
    "RULE-SET,YouTube,油管视频",

    // Streaming
    "RULE-SET,Streaming,国际媒体",

    // Apple
    "RULE-SET,Apple,苹果服务",

    // Google
    "RULE-SET,Google,谷歌服务",

    // GitHub
    "RULE-SET,github,Github",

    // Microsoft
    "RULE-SET,Microsoft,微软服务",

    // 所有 .cn 域名强制直连。
    // 原因：666OS 的 Proxy 列表混入了少量 .cn 域名（如 +.amd.com.cn、+.airbnb.cn），
    // 而本脚本 RULE-SET,Proxy 在 RULE-SET,China 之前，导致 developer.amd.com.cn
    // 这类国内站被送进代理出口，部分节点/站点风控下直接打不开。
    "DOMAIN-SUFFIX,cn,国内流量",

    // 其他代理
    "RULE-SET,Proxy,国外流量",

    // IP 纯净度 / 风险检测站：必须经代理出口访问才有意义（直连只会显示真实 IP）。
    // browserleaks.com / myip.la 被上游 China 列表误收，需抢在 China 之前接管。
    "DOMAIN-SUFFIX,ping0.cc,国外流量",
    "DOMAIN-SUFFIX,ipcheck.ing,国外流量",
    "DOMAIN-SUFFIX,ip.sb,国外流量",
    "DOMAIN-SUFFIX,ipinfo.io,国外流量",
    "DOMAIN-SUFFIX,ip-api.com,国外流量",
    "DOMAIN-SUFFIX,ipify.org,国外流量",
    "DOMAIN-SUFFIX,ipleak.net,国外流量",
    "DOMAIN-SUFFIX,browserleaks.com,国外流量",
    "DOMAIN-SUFFIX,whoer.net,国外流量",
    "DOMAIN-SUFFIX,scamalytics.com,国外流量",
    "DOMAIN-SUFFIX,ipqualityscore.com,国外流量",
    "DOMAIN-SUFFIX,myip.la,国外流量",

    // 中国大陆
    "RULE-SET,China,国内流量",

    // ==================== IP 规则 ====================

    "RULE-SET,AdvertisingIP,REJECT,no-resolve",

    "RULE-SET,PrivateIP,直接连接,no-resolve",

    "RULE-SET,XPTVIP,直接连接,no-resolve",

    // AI IP
    "RULE-SET,AIIP,人工智能,no-resolve",

    "RULE-SET,TelegramIP,电报消息,no-resolve",

    "RULE-SET,SocialMediaIP,社交平台,no-resolve",

    "RULE-SET,EmbyIP,Emby服,no-resolve",

    "RULE-SET,NetflixIP,奈飞视频,no-resolve",

    "RULE-SET,StreamingIP,国际媒体,no-resolve",

    "RULE-SET,GoogleIP,谷歌服务,no-resolve",

    "RULE-SET,ProxyIP,国外流量,no-resolve",

    "RULE-SET,ChinaIP,国内流量,no-resolve",

    // 兜底
    "MATCH,兜底流量"
  ];

  // ==================== Rule Providers ====================

  function domainMRS(url) {
    return {
      type: "http",
      behavior: "domain",
      format: "mrs",
      interval: 86400,
      proxy: "故障转移",
      url: url
    };
  }

  function ipMRS(url) {
    return {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      interval: 86400,
      proxy: "故障转移",
      url: url
    };
  }

  config["rule-providers"] = {
    // ---------- 域名 ----------

    Tracking: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Tracking.mrs"
    ),

    Advertising: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Advertising.mrs"
    ),

    Direct: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Direct.mrs"
    ),

    LocationDKS: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/LocationDKS.mrs"
    ),

    Private: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Private.mrs"
    ),

    Download: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Download.mrs"
    ),

    Speedtest: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Speedtest.mrs"
    ),

    AI: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/AI.mrs"
    ),

    Telegram: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Telegram.mrs"
    ),

    Twitter: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Twitter.mrs"
    ),

    SocialMedia: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/SocialMedia.mrs"
    ),

    NewsMedia: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/NewsMedia.mrs"
    ),

    Games: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Games.mrs"
    ),

    Crypto: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Crypto.mrs"
    ),

    Netflix: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Netflix.mrs"
    ),

    YouTube: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/YouTube.mrs"
    ),

    XPTV: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/XPTV.mrs"
    ),

    Emby: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Emby.mrs"
    ),

    Streaming: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Streaming.mrs"
    ),

    AppleCN: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/AppleCN.mrs"
    ),

    Apple: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Apple.mrs"
    ),

    Google: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Google.mrs"
    ),

    Microsoft: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Microsoft.mrs"
    ),

    Proxy: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Proxy.mrs"
    ),

    China: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/China.mrs"
    ),

    // ---------- IP ----------

    AdvertisingIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Advertising.mrs"
    ),

    PrivateIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Private.mrs"
    ),

    AIIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/AI.mrs"
    ),

    TelegramIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Telegram.mrs"
    ),

    SocialMediaIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/SocialMedia.mrs"
    ),

    XPTVIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/XPTV.mrs"
    ),

    EmbyIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Emby.mrs"
    ),

    NetflixIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Netflix.mrs"
    ),

    StreamingIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Streaming.mrs"
    ),

    GoogleIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Google.mrs"
    ),

    ProxyIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Proxy.mrs"
    ),

    ChinaIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/China.mrs"
    ),

    // ---------- WiFi Calling ----------

    ukwifi: {
      type: "http",

      behavior: "classical",

      format: "text",

      interval: 86400,

      proxy: "故障转移",

      url:
        "https://raw.githubusercontent.com/HenryChiao/wificalling/refs/heads/main/qiao/wificalling.list"
    },

    // ---------- 广告 ----------

    AWAvenueAds: domainMRS(
      "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.mrs"
    ),

    // ---------- GitHub ----------

    github: {
      type: "http",

      behavior: "classical",

      format: "yaml",

      interval: 86400,

      // 与其他 provider 统一经「故障转移」下载（kelee 域名直连在部分网络下不稳）
      proxy: "故障转移",

      url:
        "https://rule.kelee.one/Clash/GitHub.yaml"
    }
  };

  return config;
}
