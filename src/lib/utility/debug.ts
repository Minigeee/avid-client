/** Print only in dev mode */
export function debug(...args: any[]) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const e = new Error();
    const regex = /\((.*):(\d+):(\d+)\)$/;

    let trace: any = {};
    if (e.stack) {
      const match = regex.exec(e.stack.split('\n')[2]);
      trace = {
        filename: match?.[1],
        line: match?.[2],
        col: match?.[3],
      };
    }

    console.log(
      '%cDEBUG',
      'color: #40C057; font-weight: 600;',
      ...args /* , trace */,
    );
  }
}
