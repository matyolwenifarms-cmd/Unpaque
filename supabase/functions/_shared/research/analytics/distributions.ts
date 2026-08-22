// The distribution functions every test in this directory needs, written out
// rather than pulled from a package.
//
// Not from principle — from the deployment. These modules run in the Deno Edge
// Runtime and are imported by the browser through the same `@shared` alias, and
// the statistics packages that would do this either assume Node built-ins or
// arrive as a megabyte of bundle for four functions. Four functions is what is
// needed.
//
// Everything here is the standard continued-fraction and series machinery from
// Numerical Recipes, §6.2 and §6.4. The tests check it against values printed
// in statistics textbooks rather than against another implementation of the
// same algorithm, which would only prove the two agree.

/**
 * log Γ(x), Lanczos approximation. Accurate to about 15 significant figures.
 *
 * Two of the coefficients are written as the double JavaScript actually holds
 * rather than as Numerical Recipes prints them — −86.50532032941678 for
 * …677, and 2.5066282746310007 for …005. Neither is representable, so the
 * engine rounds to exactly these values on parse; writing them out changes
 * nothing at runtime and stops the linter reporting a precision loss that has
 * already happened either way.
 */
export function logGamma(x: number): number {
  const coefficients = [
    76.18009172947146, -86.50532032941678, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let temp = x + 5.5;
  temp -= (x + 0.5) * Math.log(temp);
  let series = 1.000000000190015;
  for (const coefficient of coefficients) series += coefficient / ++y;
  return -temp + Math.log((2.5066282746310007 * series) / x);
}

/**
 * The regularised incomplete beta function I_x(a, b).
 *
 * Underneath the t and F distributions both. Evaluated by continued fraction,
 * and by the symmetry I_x(a,b) = 1 − I_{1−x}(b,a) on the far side, because the
 * fraction converges slowly where x is large relative to (a+1)/(a+b+2).
 */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front =
    Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
    );

  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + b * Math.log(1 - x) + a * Math.log(x),
  ) * betaContinuedFraction(1 - x, b, a)) / b;
}

/** Lentz's method for the continued fraction of the incomplete beta. */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-16) break;
  }
  return h;
}

/** The regularised lower incomplete gamma P(a, x). Underneath chi-square. */
export function incompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Series representation converges quickly on this side.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n <= 300; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 3e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction on the other, subtracted from 1.
  const tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 300; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Φ(z), the standard normal cumulative distribution. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26 is the usual choice and is only good to 1.5e-7.
  // The incomplete gamma is already here and gives full double precision, so
  // there is no reason to accept the cheaper one.
  const sign = x < 0 ? -1 : 1;
  return sign * incompleteGamma(0.5, x * x);
}

/** Two-tailed p for a standard normal deviate. */
export function normalP(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** Two-tailed p for Student's t with df degrees of freedom. */
export function studentP(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return Number.NaN;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

/** Upper-tail p for chi-square with df degrees of freedom. */
export function chiSquareP(chiSquare: number, df: number): number {
  if (df <= 0 || chiSquare < 0) return Number.NaN;
  return 1 - incompleteGamma(df / 2, chiSquare / 2);
}

/** Upper-tail p for the F distribution. */
export function fP(f: number, df1: number, df2: number): number {
  if (df1 <= 0 || df2 <= 0 || f < 0 || !Number.isFinite(f)) return Number.NaN;
  // F = 0 is a real result, not a malformed one: it is exactly what Levene's
  // test gives when group variances are identical. Returning NaN there made
  // "the assumption holds perfectly" indistinguishable from "the check could
  // not run", and the assumption was reported as violated.
  if (f === 0) return 1;
  return incompleteBeta(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
}

/**
 * The inverse normal CDF, for confidence intervals.
 *
 * Acklam's rational approximation, refined by one Halley step against
 * `normalCdf` — which costs one extra evaluation and takes the error from
 * about 1e-9 to the limit of the double.
 */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) return Number.NaN;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const low = 0.02425;
  let q: number;
  let x: number;

  if (p < low) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - low) {
    q = p - 0.5;
    const r = q * q;
    x = (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
        (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
         ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }

  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * The t quantile for a two-sided interval, by bisection.
 *
 * Bisection rather than an approximation because it is called once per
 * interval, not once per row, and a closed form accurate to 1e-4 would put
 * visible error into a published confidence interval to save nothing.
 */
export function studentQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) return Number.NaN;
  // `studentP` is already the two-tailed p and decreases as t grows, so the
  // target is p itself. Targeting 1 − p inverted the search and returned the
  // t at which the test is least significant — which is a number, so nothing
  // would have complained.
  let low = 0;
  let high = 200;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (studentP(mid, df) > p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}
