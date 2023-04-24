import { PropsWithChildren } from 'react';
import { ErrorBoundary as BaseErrorBoundary, ErrorBoundaryProps as BaseErrorBoundaryProps } from 'react-error-boundary';

import { notifyError } from '@/lib/utility/error-handler';


////////////////////////////////////////////////////////////
type ErrorBoundaryProps = PropsWithChildren<{
  title?: string;
  message?: string;
}>;

////////////////////////////////////////////////////////////
export default function ErrorBoundary({ title, message, ...props }: ErrorBoundaryProps) {
  return (
    <BaseErrorBoundary
      fallback={<div>a</div>}
      onError={(error, info) => {
        notifyError(error, { title, message });
      }}
    >
      {props.children}
    </BaseErrorBoundary>
  );
}
