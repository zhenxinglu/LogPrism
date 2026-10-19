/**
 * Log entry generator that produces realistic, production-like logs
 * with ISO timestamps, standard log levels, single-line payloads,
 * and multi-line exception stack traces.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogGeneratorOptions {
  errorRatio?: number // Probability of generating WARN/ERROR (0.0 - 1.0)
}

const SERVICES = [
  'c.e.auth.filter.JwtAuthenticationFilter',
  'c.e.order.service.OrderServiceImpl',
  'c.e.payment.channel.StripePaymentClient',
  'c.e.inventory.cache.RedisStockSynchronizer',
  'c.e.gateway.route.DynamicRouteMatcher',
  'c.e.notification.mq.RabbitMqConsumer',
  'c.e.user.controller.UserProfileController',
  'c.e.analytics.collector.EventStreamPipeline'
]

const THREAD_NAMES = [
  'http-nio-8080-exec-1',
  'http-nio-8080-exec-4',
  'http-nio-8080-exec-9',
  'async-task-executor-2',
  'scheduled-sync-pool-1',
  'kafka-consumer-group-3',
  'payment-worker-thread-5'
]

function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number, z = 2): string => String(n).padStart(z, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  const ms = pad(date.getMilliseconds(), 3)
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms}`
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate a single normal log entry
 */
export function generateNormalLog(level: 'INFO' | 'DEBUG' | 'WARN' = 'INFO'): string {
  const timestamp = formatTimestamp()
  const thread = getRandomElement(THREAD_NAMES)
  const service = getRandomElement(SERVICES)
  const userId = getRandomInt(1000, 9999)
  const orderId = `ORD-${getRandomInt(100000, 999999)}`
  const latency = getRandomInt(4, 380)

  let message = ''

  if (level === 'DEBUG') {
    const debugTemplates = [
      `Validating incoming request headers: X-Request-ID=${getRandomInt(1000000, 9999999)}, Client-IP=192.168.1.${getRandomInt(10, 250)}`,
      `SQL Query executed in ${latency}ms: SELECT id, username, email FROM users WHERE id = ${userId} /* cache-miss */`,
      `Redis cache hit for key "session:${userId}:profile", TTL=1795s`,
      `Route evaluated: /api/v2/orders/${orderId} -> order-service upstream latency=${latency}ms`,
      `Payload payload: {"userId": ${userId}, "action": "FETCH_CART", "timestamp": ${Date.now()}}`
    ]
    message = getRandomElement(debugTemplates)
  } else if (level === 'WARN') {
    const warnTemplates = [
      `Database connection pool acquisition latency high: waitTime=${latency}ms, activePoolSize=19/20`,
      `Circuit breaker half-open state for upstream service "recommendation-service", failing 12% of requests`,
      `User token expires in 60s for principal user_${userId}, initiating silent refresh`,
      `Disk I/O utilization reached 84% on mount /var/log/app, auto-cleanup triggered`,
      `Slow API response from third-party gateway [${latency + 600}ms] for order ${orderId}`
    ]
    message = getRandomElement(warnTemplates)
  } else {
    // INFO
    const infoTemplates = [
      `User authentication succeeded for principal user_${userId}, roles=[ROLE_USER, ROLE_CUSTOMER]`,
      `Order checkout completed successfully: orderId=${orderId}, amount=${(getRandomInt(15, 450) + 0.99).toFixed(2)} USD, latency=${latency}ms`,
      `Received batch message from queue "order.notifications.v1", processed ${getRandomInt(1, 15)} records`,
      `HTTP POST /api/v1/orders/checkout returned 201 Created in ${latency}ms`,
      `Cache refreshed for catalog category id=${getRandomInt(1, 40)}, item count=${getRandomInt(50, 200)}`,
      `Kafka producer committed batch offset=${getRandomInt(10000, 50000)} to partition 2 in ${latency}ms`
    ]
    message = getRandomElement(infoTemplates)
  }

  return `${timestamp} ${level.padEnd(5)} [${thread}] ${service}: ${message}`
}

/**
 * Generate a multi-line exception log entry with realistic stack traces
 */
export function generateExceptionLog(): string {
  const timestamp = formatTimestamp()
  const thread = getRandomElement(THREAD_NAMES)
  const orderId = `ORD-${getRandomInt(100000, 999999)}`
  const userId = getRandomInt(1000, 9999)

  const exceptionScenarios = [
    {
      service: 'c.e.payment.channel.StripePaymentClient',
      firstLine: `Failed to process charge for order ${orderId}: NullPointerException encountered during token extraction`,
      trace: [
        'java.lang.NullPointerException: Cannot invoke "com.example.payment.model.PaymentToken.getValue()" because "token" is null',
        '    at com.example.payment.channel.StripePaymentClient.processCharge(StripePaymentClient.java:142)',
        '    at com.example.payment.channel.StripePaymentClient.executeWithRetry(StripePaymentClient.java:88)',
        '    at com.example.payment.service.PaymentProcessor.process(PaymentProcessor.java:54)',
        '    at com.example.order.service.OrderServiceImpl.checkout(OrderServiceImpl.java:215)',
        '    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)',
        '    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:77)',
        '    at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)',
        '    at java.base/lang.reflect.Method.invoke(Method.java:568)'
      ]
    },
    {
      service: 'c.e.inventory.cache.RedisStockSynchronizer',
      firstLine: `Distributed lock acquisition timed out for sku=SKU-${getRandomInt(10000, 99999)}`,
      trace: [
        'org.springframework.dao.QueryTimeoutException: Redis command timed out; nested exception is io.lettuce.core.RedisCommandTimeoutException: Command timed out after 3000ms',
        '    at org.springframework.data.redis.connection.lettuce.LettuceExceptionConverter.convert(LettuceExceptionConverter.java:70)',
        '    at org.springframework.data.redis.connection.lettuce.LettuceConnection.eval(LettuceConnection.java:1520)',
        '    at com.example.inventory.cache.RedisStockSynchronizer.acquireLock(RedisStockSynchronizer.java:79)',
        '    at com.example.inventory.service.StockService.deductStock(StockService.java:112)',
        '    at com.example.order.service.OrderServiceImpl.checkout(OrderServiceImpl.java:198)',
        '    at org.springframework.transaction.interceptor.TransactionAspectSupport.invokeWithinTransaction(TransactionAspectSupport.java:388)'
      ]
    },
    {
      service: 'c.e.auth.filter.JwtAuthenticationFilter',
      firstLine: `JWT signature validation failed for principal user_${userId}: Token expired or malformed`,
      trace: [
        'io.jsonwebtoken.ExpiredJwtException: JWT expired at 2026-09-23T08:50:00Z. Current time: 2026-09-23T08:56:00Z, a difference of 360000 milliseconds.',
        '    at io.jsonwebtoken.impl.DefaultJwtParser.parse(DefaultJwtParser.java:382)',
        '    at io.jsonwebtoken.impl.DefaultJwtParser.parseClaimsJws(DefaultJwtParser.java:541)',
        '    at com.example.auth.service.JwtTokenProvider.validateToken(JwtTokenProvider.java:65)',
        '    at com.example.auth.filter.JwtAuthenticationFilter.doFilterInternal(JwtAuthenticationFilter.java:48)',
        '    at org.springframework.web.filter.OncePerRequestFilter.doFilter(OncePerRequestFilter.java:117)',
        '    at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:189)'
      ]
    }
  ]

  const scenario = getRandomElement(exceptionScenarios)
  const header = `${timestamp} ERROR [${thread}] ${scenario.service}: ${scenario.firstLine}`
  return [header, ...scenario.trace].join('\n')
}

/**
 * Generate next log entry based on error probability
 */
export function generateNextLog(options: LogGeneratorOptions = {}): string {
  const errorRatio = options.errorRatio ?? 0.15
  const rand = Math.random()

  if (rand < errorRatio * 0.4) {
    // Multi-line error exception
    return generateExceptionLog()
  } else if (rand < errorRatio) {
    // Single-line WARN or ERROR
    const lvl = Math.random() > 0.4 ? 'WARN' : 'ERROR'
    return generateNormalLog(lvl)
  } else if (rand < errorRatio + 0.15) {
    return generateNormalLog('DEBUG')
  } else {
    return generateNormalLog('INFO')
  }
}

/**
 * Generate a burst of log lines (e.g., sudden spike during incident)
 */
export function generateBurstLogs(count = 500, errorRatio = 0.5): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.push(generateNextLog({ errorRatio }))
  }
  return result
}
