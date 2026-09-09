// FlClash (Android) 全局覆写脚本（优化版）
// 作用：保留当前机场的 proxies / proxy-providers，统一替换代理组、规则与 DNS。
// 使用位置：FlClash → 配置 → 覆写 → 新建 JavaScript 覆写 → 粘贴本脚本 → 在配置中启用
//
// 由 Clash Verge Rev 桌面版脚本适配而来，安卓端差异：
//   1. 移除 TUN 覆盖 —— Android 上由 FlClash 的 VPN 模式（VpnService）自行接管
//   2. find-process-mode 保持 strict —— mihomo 在 Android 上 PROCESS-NAME 规则可匹配应用包名，用于 Gemini/NotebookLM APP 分流
//      ⚠️ 重要：FlClash 应用层会用「覆写编辑器 → 常规 → 查找进程」开关的值覆盖此设置（默认关闭 = off）。
//      必须在 FlClash 界面里打开「查找进程」开关，PROCESS-NAME 包名规则才会生效（见 issue #2100，进程解析经
//      getConnectionOwnerUid() → 包名，链路本身可用）。仅靠脚本设置无效。
//   3. keep-alive-interval 放宽到 30 —— 省电，减少移动网络下的频繁唤醒
//   4. 移除 quic-go-disable-gso —— 仅 Linux 内核有效，Android 上无用
//
// ==================== 本版相对上版的改动 ====================
//  [功能修复]
//  A. 「抖快书定位」此前被包名直连规则抢先生效，对抖音/快手/小红书形同虚设 ——
//     LocationDKS 规则移至全部规则最前，定位域名优先于整应用直连
//  B. QUIC 阻断规则从「直连块之后」移至「China 之后、IP 规则之前」——
//     已被域名规则分类的流量（无论直连还是代理）QUIC 不再被误杀（如 B 站等国内站的 HTTP/3），
//     仅「未命中任何域名规则的流量（裸 IP 连接 / 兜底）」禁 QUIC，防止无域名上下文的 QUIC 绕过嗅探分流。
//     若你的节点 UDP 转发较差、希望代理方向强制走 TCP，把该规则移回 Private/Direct 直连块之后即可
//  [DNS]
//  C. 国外 DoH 改为 IP 直连形式（1.1.1.1 / 8.8.8.8）—— 免除 bootstrap 域名解析，免疫 bootstrap 污染
//  D. fake-ip-filter 新增 +.pool.ntp.org（Android 默认 NTP 源 2.android.pool.ntp.org 等）；
//     nameserver-policy 为 time/ntp/pool.ntp.org 补国内 DoH 直连解析（原先落到经代理的国外 DoH）
//  E. 移除 nameserver-policy 中 rcode://success 的广告策略 —— fake-ip 模式下广告域名直接返回 fake-ip、
//     由连接层 REJECT 拦截，该 DNS 策略实际永不触发（广告拦截效果不变，由规则层保证）
//  [嗅探]
//  F. 移除 QUIC 嗅探 —— fake-ip 模式下域名信息随 DNS 映射传递，QUIC 嗅探无实际收益，省去握手解析开销
//  [其他]
//  G. 新增 global-client-fingerprint: chrome —— 统一 TLS Client Hello 指纹
//  H. 节点筛选正则：移除从不匹配任何节点的「排除1|排除2」占位符（需要排除时在负向预查里补关键词即可，
//     「5x」倍率节点排除保留）；补「狮城|獅城」（新加坡）、「首爾」（韩国繁体）别名，
//     与「全球手动」排序正则的词表对齐，避免两套词表漂移
//  I. 代码重构：rule-providers / 地区策略组 / 业务选择列表改为数据驱动生成，行为不变，代码量约减半；
//     「全球手动」排序的优先级判断直接复用节点筛选正则（编译前剥离 mihomo 专用的 (?i) 内联标志）
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
  // IPv6 刻意关闭（与 FlClash 应用层 IPv6 开关的关闭状态对齐）：
  // dns.ipv6=true 会让 DNS 返回 AAAA，而 VpnService 未启用 IPv6 时，
  // 兜底直连场景下浏览器的 AAAA 先试可能经物理网卡 IPv6 绕开 mihomo
  // 造成 DNS/流量泄露。未来启用 IPv6 时需同步修改此处、下方 dns.ipv6
  // 和 FlClash 应用开关三处。
  config.ipv6 = false;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  // 统一 TLS Client Hello 指纹为 chrome，降低节点侧特征识别
  config["global-client-fingerprint"] = "chrome";
  // 注意：此值会被 FlClash 应用层「覆写 → 常规 → 查找进程」开关覆盖，
  // 手机上需手动开启该开关（=always），否则 PROCESS-NAME 包名规则不生效
  config["find-process-mode"] = "strict";
  config["keep-alive-interval"] = 30;
  config["keep-alive-idle"] = 600;
  // TUN 不做任何覆盖：FlClash 的 VPN 模式（TUN/Http 等）由应用内设置管理，
  // 脚本侧设置 auto-redirect / stack 反而可能与 VpnService 冲突。
  config.profile = Object.assign(
    {},
    config.profile || {},
    {
      "store-selected": true,
      "store-fake-ip": true
    }
  );

  // ==================== 流量嗅探 ====================
  // 仅嗅探 HTTP / TLS。QUIC 嗅探已移除：fake-ip 模式下域名信息随 DNS 映射传递，
  // 未分类流量的 QUIC 已由 REJECT 规则兜底，QUIC 嗅探无实际收益。
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
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter": [
      "+.lan",
      "+.local",
      "time.*.com",
      "ntp.*.com",
      // Android 默认 NTP 源（2.android.pool.ntp.org 等）
      "+.pool.ntp.org",
      "+.market.xiaomi.com",
      "+.pub.3gppnetwork.org",
      "+.push.apple.com",
      "+.bing.com",
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
    // 国外 DoH 用 IP 直连形式：免 bootstrap 域名解析，彻底免疫 bootstrap 污染。
    // 显式绑定「故障转移」组：DNS 出口与业务组选择解耦，
    // 业务组切直连时 DoH 查询链路不受影响（fail-closed：组挂则 DNS 挂）
    nameserver: [
      "https://1.1.1.1/dns-query#故障转移",
      "https://8.8.8.8/dns-query#故障转移"
    ],
    "direct-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],
    "proxy-server-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],
    "nameserver-policy": {
      // fake-ip-filter 放行的 NTP/时间域名走国内 DoH 直连解析，
      // 避免落到默认 nameserver（经代理的国外 DoH）拿到远端调度 IP
      "time.*.com,ntp.*.com,+.pool.ntp.org": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],
      "+.cn": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],
      "rule-set:Direct,Private,China": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],
      "rule-set:Speedtest,Twitter,Telegram,SocialMedia,NewsMedia,Games,Crypto,Emby,Netflix,YouTube,Streaming,Apple,Google,Microsoft,Proxy": [
        "https://8.8.8.8/dns-query#故障转移",
        "https://1.1.1.1/dns-query#故障转移"
      ]
    }
  };

  // ==================== 节点筛选 ====================
  // 说明：原「排除1|排除2」为占位符（从不匹配任何节点名）已移除；
  // 需要排除特定关键词时，在对应负向预查 (?!.*( ... )) 中补充即可。「5x」用于排除倍率节点，保留。
  const FilterHK =
    "(?i)^(?=.*(港|🇭🇰|\\bHK\\b|Hong|HKG))(?!.*(5x)).*$";
  const FilterSG =
    "(?i)^(?=.*(坡|狮城|獅城|🇸🇬|\\bSG\\b|Sing|SIN|XSP))(?!.*(5x)).*$";
  const FilterJP =
    "(?i)^(?=.*(日|🇯🇵|樱花|🌸|东京|大阪|\\bJP\\b|Japan|NRT|HND|KIX|CTS|FUK))(?!.*(尼日利亚|5x)).*$";
  const FilterKR =
    "(?i)^(?=.*(韩|🇰🇷|韓|首尔|首爾|南朝鲜|\\bKR\\b|\\bKOR\\b|Korea))(?!.*(Africa|5x)).*$";
  const FilterUS =
    "(?i)^(?=.*(美|🇺🇸|\\bUS\\b|\\bUSA\\b|JFK|SJC|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD))(?!.*(Plus|Australia|5x)).*$";
  const FilterTW =
    "(?i)^(?=.*(台|🇹🇼|\\bTW\\b|Taiwan|TPE|TSA|KHH))(?!.*(5x)).*$";
  const FilterEU =
    "(?i)^(?=.*(奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉|立|卢|马耳他|荷|波|葡|罗|斯洛伐|斯洛文|西班牙|瑞|英|倫敦|伦敦|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|🇬🇧|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|LHR|LGW|\\bUK\\b|London|United\\s*Kingdom))(?!.*(5x)).*$";
  const FilterMO =
    "(?i)^(?=.*(澳门|澳門|濠江|🇲🇴|\\bMO\\b|Macau|Macao|MFM|Taipa|氹仔|路氹|路环|Coloane|Cotai|MOG))(?!.*(5x)).*$";
  const FilterOT =
    "(?i)^(?!.*(超时|重启|维护|暂停|失效|公告|套餐|到期|距离|剩余|天数|即将|重置|下次|官网|客服|网站|网址|过期|已用|联系|邮箱|工单|通知|失败|挂掉|未知地区|未知节点|DIRECT|直接连接|美|港|坡|台|狮城|獅城|日|樱花|🌸|东京|大阪|韩|奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉|立|卢|马耳他|荷|波|葡|罗|斯洛伐|斯洛文|西班牙|瑞|英|倫敦|伦敦|澳门|澳門|濠江|🇭🇰|🇹🇼|🇸🇬|🇯🇵|🇰🇷|🇺🇸|🇬🇧|🇲🇴|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|\\bHK\\b|\\bTW\\b|\\bSG\\b|\\bJP\\b|\\bKR\\b|\\bUS\\b|\\bGB\\b|\\bUK\\b|\\bMO\\b|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|HKG|TPE|TSA|KHH|SIN|XSP|NRT|HND|KIX|CTS|FUK|JFK|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|LHR|LGW|London|United\\s*Kingdom|MFM|MOG|Taipa|Coloane|Cotai))";
  // 机场信息节点统一排除规则（流量/到期/公告等），供各策略组 exclude-filter 复用
  const excludeInfoNodes =
    "(?i)流量|到期|套餐|公告|维护|官网|客服|重置|剩余|失效|暂停|过期|超时|重启";
  const FilterAL =
    "^(?!.*(DIRECT|直接连接|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别行政区|访问|支持|教程|关注|更新|作者|加入|超时|重启|维护|暂停|失效|公告|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))";

  // ==================== 地区定义（数据驱动） ====================
  // regions 顺序 = 代理组展示顺序（策略组/自动测速/负载均衡同此序）
  const regions = [
    {
      key: "香港",
      filter: FilterHK,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Hong_Kong.png"
    },
    {
      key: "台湾",
      filter: FilterTW,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Taiwan.png"
    },
    {
      key: "狮城",
      filter: FilterSG,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Singapore.png"
    },
    {
      key: "日本",
      filter: FilterJP,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Japan.png"
    },
    {
      key: "韩国",
      filter: FilterKR,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Korea.png"
    },
    {
      key: "美国",
      filter: FilterUS,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/United_States.png"
    },
    {
      key: "欧盟",
      filter: FilterEU,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/European_Union.png"
    },
    {
      key: "澳门",
      filter: FilterMO,
      icon: "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Macao.png"
    }
  ];

  // ==================== 策略组公共列表 ====================
  // 业务选择组里地区项的排列顺序（与 regions 展示顺序相互独立）
  const selectRegionKeys = [
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧盟策略"
  ];
  const selectTail = [
    ...selectRegionKeys,
    "冷门自选",
    "全球手动",
    "直接连接"
  ];
  const selectPY = ["默认代理", "故障转移", ...selectTail];
  const selectFB = ["故障转移", ...selectTail];
  const selectDC = [
    "直接连接",
    "默认代理",
    "故障转移",
    ...selectRegionKeys,
    "冷门自选",
    "全球手动"
  ];
  const selectUS = [
    "美国策略",
    ...selectPY.filter(name => name !== "美国策略")
  ];
  const selectSG = [
    "狮城策略",
    ...selectPY.filter(name => name !== "狮城策略")
  ];

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
  // 地区优先级直接复用上方节点筛选正则（编译前剥离 mihomo 专用的 (?i) 内联标志），
  // 避免维护两套词表；英/德/法在 FilterEU 基础上单独细化排序。
  const globalPriorityTable = [
    [FilterHK, 10],
    [FilterMO, 15],
    [FilterTW, 20],
    [FilterSG, 30],
    [FilterJP, 40],
    [FilterKR, 50],
    [FilterUS, 60],
    ["(英国|英國|🇬🇧|\\bUK\\b|\\bGB\\b|United\\s*Kingdom|London|LHR|LGW)", 70],
    ["(德国|德國|🇩🇪|\\bDE\\b|Germany|Frankfurt|FRA|MUC)", 80],
    ["(法国|法國|🇫🇷|\\bFR\\b|France|Paris|CDG)", 90]
  ];
  function getGlobalManualProxies() {
    if (!Array.isArray(config.proxies)) {
      return [];
    }
    const excludeRegex =
      /(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|超时|重启|维护|暂停|失效|公告|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)/i;
    function getPriority(name) {
      for (let i = 0; i < globalPriorityTable.length; i++) {
        // 剥离 mihomo 正则的 (?i) 内联标志（JS RegExp 不支持内联 flag）
        const pattern =
          globalPriorityTable[i][0].replace(/^\(\?i\)/, "");
        if (new RegExp(pattern, "i").test(name)) {
          return globalPriorityTable[i][1];
        }
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

    // ---- 地区策略组（香港/台湾/狮城/日本/韩国/美国/欧盟/澳门）----
    ...regions.map(region =>
      regionSelect(
        region.key + "策略",
        region.filter,
        region.key + "自动",
        region.key + "均衡-散列",
        region.key + "均衡-轮询",
        region.icon
      )
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

    // ---- 地区自动测速 ----
    ...regions.map(region =>
      urlTest(region.key + "自动", region.filter)
    ),

    // ---- 地区负载均衡（一致性哈希）----
    ...regions.map(region =>
      loadBalance(
        region.key + "均衡-散列",
        region.filter,
        "consistent-hashing",
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
      )
    ),

    // ---- 地区负载均衡（轮询）----
    ...regions.map(region =>
      loadBalance(
        region.key + "均衡-轮询",
        region.filter,
        "round-robin",
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
      )
    )
  ];

  // ==================== 国内应用直连（Android 包名）====================
  // 目标：所有国内 App 整应用直连，不依赖域名列表是否收录。
  // 原理：Android 上 mihomo 的 PROCESS-NAME 匹配应用包名；常用厂商包名有规律
  // （com.tencent / com.taobao / com.netease ...），用 PROCESS-NAME-REGEX 按前缀
  // 一网打尽；包名无规律的（支付宝 / 滴滴 / 12306 等）走精确匹配。
  // ⚠️ 需在 FlClash「覆写 → 常规 → 查找进程」打开开关，否则包名规则不生效（见 issue #2100）。
  // ⚠️ PROCESS-NAME-REGEX 需 mihomo v1.18.8+（FlClash 近年版本均内置）。

  const cnAppPackagePrefixes = [
    // 腾讯系（微信、QQ、王者、腾讯视频、应用宝、腾讯游戏 com.tencent.tmgp.* ...）
    "com.tencent",
    // 阿里系（淘宝、天猫、闲鱼、钉钉、 UC 夸克入口）
    "com.taobao",
    "com.alibaba",
    "com.alipay",
    "com.eg.android", // 支付宝正式包名 com.eg.android.AlipayGphone
    // 拼多多
    "com.xunmeng",
    // 小米系（含米家、小爱、应用商店）
    "com.xiaomi",
    "com.miui",
    "com.duokan", // 多看
    // 华为 / 荣耀系
    "com.huawei",
    "com.hihonor",
    // 字节系（抖音、今日头条、西瓜、番茄）
    "com.ss.android",
    // 快手
    "com.smile",
    // 百度系（百度 App、地图、网盘、贴吧）
    "com.baidu",
    // 网易系（云音乐、邮箱大师、网易游戏）
    "com.netease",
    // B 站
    "com.bilibili",
    // 微博
    "com.sina",
    // 知乎 / 豆瓣 / 酷安 / 小红书
    "com.zhihu",
    "com.douban",
    "com.coolapk",
    "com.xingin",
    // 京东
    "com.jingdong",
    // 美团 / 大众点评
    "com.sankuai",
    "com.dianping",
    "com.meituan",
    // 高德
    "com.autonavi",
    // 游戏厂商：米哈游 / 鹰角 / 库洛 / 游卡 / 边锋 / 三国杀渠道服
    "com.mihoyo", // (?i) 大小写不敏感，覆盖 com.miHoYo
    "com.hypergryph",
    "com.kurogame",
    "com.yoka",
    "com.bianfeng",
    "com.bf",
    "com.sgs10th", // 三国杀：一将成名渠道服（com.sgs10th.nearme.gamecenter 等）
    // 运营商 / 金融
    "com.chinamworld", // 建行、中行
    "com.unionpay", // 云闪付
    "com.sinovatech", // 联通
    "com.greenpoint", // 中国移动
    "com.icbc",
    "com.pingan", // 平安系
    "com.cmbchina", // 招商银行
    "com.bankcomm", // 交通银行
    "com.psbc", // 邮储银行
    "com.ecitic", // 中信银行
    // 手机厂商 OPPO / 一加 / vivo 系（渠道服游戏、应用商店都在这些包名下）
    "com.oplus",
    "com.heytap",
    "com.nearme",
    "com.oppo",
    "com.coloros",
    "com.oneplus",
    "com.vivo",
    "com.bbk",
    // 长尾大厂：视频 / 音乐 / 直播 / 生活 / 工具
    "com.qiyi", // 爱奇艺
    "com.youku", // 优酷
    "com.kugou", // 酷狗
    "com.jd", // 京东金融等（京东商城本身是 com.jingdong）
    "com.qihoo", // 360 系
    "com.sohu", // 搜狐 / 搜狗输入法
    "com.ucmobile", // UC 浏览器
    "com.quark", // 夸克
    "com.douyu", // 斗鱼
    "com.duowan", // 虎牙
    "com.alicloud", // 阿里云盘
    "me.ele", // 饿了么
    "com.anjuke", // 安居客
    "com.achievo", // 唯品会
    "com.homelink", // 链家
    "com.beike", // 贝壳
    "com.jingyao", // 哈啰
    "com.umetrip", // 航旅纵横
    "com.qunar", // 去哪儿
    "com.kuaikan", // 快看漫画
    "com.moji", // 墨迹天气
    // 所有 cn.* 包名空间（WPS、虎扑等大量国内 App 采用）
    "cn"
  ];

  // 包名无规律的主流国内 App（精确匹配）
  const cnAppExactPackages = [
    "com.sdu.didi.ps", // 滴滴出行
    "ctrip.android.view", // 携程旅行
    "com.MobileTicket", // 铁路 12306
    "com.tongcheng.android", // 同程旅行
    "com.wuba", // 58同城
    "com.android.bankabc", // 农业银行
    "com.ct.client" // 中国电信
  ];

  const cnAppPrefixRegex = cnAppPackagePrefixes
    .map(p => p.replace(/\./g, "\\."))
    .join("|");

  const processNameCNApps = [
    // 1) 特殊包名精确直连
    ...cnAppExactPackages.map(
      p => "PROCESS-NAME," + p + ",直接连接"
    ),
    // 2) 常见厂商包名前缀批量直连（大小写不敏感）
    "PROCESS-NAME-REGEX,(?i)^(" +
      cnAppPrefixRegex +
      "),直接连接"
  ];

  // ==================== 分流规则 ====================
  config.rules = [
    // ==================== 抖音 / 快手 / 小红书定位 ====================
    // ⚠️ 必须放在包名直连规则之前：抖音（com.ss.android）/ 快手（com.smile）/
    // 小红书（com.xingin）已被下方 PROCESS-NAME 整应用直连，若定位规则在后，
    // 这些 App 的全部流量（含定位域名）都会先命中直连，本规则组永不生效。
    "RULE-SET,LocationDKS,抖快书定位",

    // ==================== 国内应用直连（Android 包名）====================
    // Android 上 mihomo 的 PROCESS-NAME 匹配应用包名，可整应用强制直连，
    // 覆盖域名列表收不齐的场景：小程序业务域名（宅印等）、游戏服务器 IP 等。
    // 放在最前，保证不被广告 REJECT / QUIC 阻断 / 兜底代理抢先命中。
    // ⚠️ 需在 FlClash「覆写 → 常规 → 查找进程」打开开关，否则包名规则不生效（见 issue #2100）。
    ...processNameCNApps,

    // 广告与跟踪
    "RULE-SET,Tracking,REJECT",
    "RULE-SET,AWAvenueAds,REJECT",
    "RULE-SET,Advertising,REJECT",

    // WiFi Calling
    "RULE-SET,ukwifi,UKwifi",

    // 私有 / 直连
    "RULE-SET,Private,直接连接",
    "RULE-SET,Direct,直接连接",
    "RULE-SET,XPTV,直接连接",
    "RULE-SET,Download,直接连接",
    "RULE-SET,AppleCN,直接连接",

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

    // 阻止 QUIC（置于 China 之后、IP 规则之前：
    // 所有已被域名规则分类的流量——无论直连还是代理——QUIC 不再被误杀，
    // 如 B 站等国内站的 HTTP/3 可正常直连；仅「未命中任何域名规则的流量」
    // （裸 IP 连接 / 兜底）禁用 QUIC，防止无域名上下文的 QUIC 绕过嗅探分流。
    // 若希望代理方向强制走 TCP（节点 UDP 转发较差时），把本条上移到
    // 上方「私有 / 直连」规则块之后即可）
    "AND,((DST-PORT,443),(NETWORK,UDP)),REJECT",

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

  // 666OS 规则集（域名 / IP 两类，同一 base URL，数据驱动生成）
  const RULES_BASE =
    "https://github.com/666OS/rules/raw/release/mihomo";
  const domainRuleSets = [
    "Tracking",
    "Advertising",
    "Direct",
    "LocationDKS",
    "Private",
    "Download",
    "Speedtest",
    "AI",
    "Telegram",
    "Twitter",
    "SocialMedia",
    "NewsMedia",
    "Games",
    "Crypto",
    "Netflix",
    "YouTube",
    "XPTV",
    "Emby",
    "Streaming",
    "AppleCN",
    "Apple",
    "Google",
    "Microsoft",
    "Proxy",
    "China"
  ];
  const ipRuleSets = [
    "Advertising",
    "Private",
    "AI",
    "Telegram",
    "SocialMedia",
    "XPTV",
    "Emby",
    "Netflix",
    "Streaming",
    "Google",
    "Proxy",
    "China"
  ];

  config["rule-providers"] = {};
  domainRuleSets.forEach(name => {
    config["rule-providers"][name] = domainMRS(
      RULES_BASE + "/domain/" + name + ".mrs"
    );
  });
  ipRuleSets.forEach(name => {
    config["rule-providers"][name + "IP"] = ipMRS(
      RULES_BASE + "/ip/" + name + ".mrs"
    );
  });

  // ---------- WiFi Calling ----------
  config["rule-providers"].ukwifi = {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    proxy: "故障转移",
    url:
      "https://raw.githubusercontent.com/HenryChiao/wificalling/refs/heads/main/qiao/wificalling.list"
  };

  // ---------- 广告 ----------
  config["rule-providers"].AWAvenueAds = domainMRS(
    "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.mrs"
  );

  // ---------- GitHub ----------
  config["rule-providers"].github = {
    type: "http",
    behavior: "classical",
    format: "yaml",
    interval: 3600,
    proxy: "DIRECT",
    url:
      "https://rule.kelee.one/Clash/GitHub.yaml"
  };

  return config;
}
