import { AxiosError } from 'axios';
import { captureException, setExtra } from '@sentry/nextjs';

import config from '@/config';
import notification from './notification';


/** Print and display error notification */
export function notifyError(error: Error, options?: { title?: string, message?: string, cooldown?: number, notify?: boolean }) {
	console.error(error);

	// Notification
	notification.error(
		options?.title || 'Error',
		options?.message || `An error has occurred. ${config.app.support_message}`,
		error,
		options?.cooldown
	);

	// Save error
	if (options?.notify !== false) {
		if (error instanceof AxiosError)
			setExtra('error', error.config);
		else
			setExtra('error', error);
			
		captureException(error);
	}
}


////////////////////////////////////////////////////////////
type AxiosErrorHandlerOptions = {
	/** Called when no response is received from axios request */
	no_response?: (error: AxiosError) => void;
	/** Called on status 401 */
	err_401?: (error: AxiosError) => void;
	/** Called on status 403 */
	err_403?: (error: AxiosError) => void;
	/** Called when a 4xx response is receieved */
	bad_input?: (error: AxiosError) => void;
	/** Called when a 5xx response is receieved */
	internal_error?: (error: AxiosError) => void;
	/** Called when an error occurs while setting up the request */
	unknown_error?: (error: AxiosError) => void;

	/** Notification title for internal error */
	title?: string;
	/** Notification message for internal error (don't end with period) */
	message?: string;
	/** Indicates if error should be propagated */
	propagate?: boolean;
};

/** Axios error handler that chooses an error callback based on the axios error */
export function axiosHandler(error: AxiosError, options?: AxiosErrorHandlerOptions) {
	if (error.response) {
		const status = error.response.status;

		// Unauthenticated
		if (status === 401) {
			// Unauthenticated
			options?.err_401 ?
				options?.err_401?.(error) :
				notifyError(
					error, {
					title: options?.title || `Authentication Error`,
					message: 'You do not have valid credentials.'
				});
		}

		// Unauthorized
		else if (status === 403) {
			// Unautorized
			options?.err_403 ?
				options?.err_403?.(error) :
				notifyError(
					error, {
					title: options?.title || `Authorization Error`,
					message: 'You are not authorized to perform the requested action. Please make sure you have the correct permissions.',
				});
		}

		else if (status >= 400 && status < 500) {
			// By default, do nothing for bad input
			options?.bad_input ?
				options?.bad_input?.(error) :
				notifyError(
					error, {
					title: options?.title || `Application Error`,
					message: `${options?.message || 'An application error has occurred'}. ${config.app.support_message}`,
				});
		}

		else if (status >= 500) {
			// For default error handler, don't send log message because error originated from server and should be logged already
			options?.internal_error ?
				options.internal_error(error) :
				notifyError(
					error, {
					title: options?.title || `Server Error`,
					message: `${options?.message || 'An internal server or database error has occurred'}. ${config.app.support_message}`,
				});
		}

		else {
			options?.unknown_error ?
				options.unknown_error(error) :
				notifyError(error, { message: error.message });
		}
	}

	else if (error.request) {
		options?.no_response ?
			options.no_response(error) :
			notifyError(
				error, {
				title: error.message || 'Network Error',
				message: `Could not reach server. Please wait a while and try again. ${config.app.support_message}`
			});
	}

	else {
		// Something happened in setting up the request that triggered an Error
		options?.unknown_error ?
			options.unknown_error(error) :
			notifyError(error, { message: error.message });
	}

	// Propagate error if specified
	if (options?.propagate)
		throw error;
}


/** Error handler for swr */
export function swrHandler(error: AxiosError | Error, key: string) {
	if (error instanceof AxiosError) {
		// An error occured while communicating with server
		const method = error.config?.method?.toLowerCase();
		axiosHandler(error, {
			message: `An error occurred while ${method === 'post' ? 'posting' : method === 'put' ? 'modifying' : 'retrieving'} data`,
		});
	}
	else {
		// An error occurred in code somewhere else (keep long cooldown because swr retries a lot)
		notifyError(
			error, {
			title: 'Application Error',
			message: `An application error has occurred. ${config.app.support_message}`,
		});
	}
}


/** General error handler */
export function errorHandler(error: any, options?: AxiosErrorHandlerOptions) {
	if (error instanceof AxiosError) {
		// An error occured while communicating with server
		axiosHandler(error, options);
	}

	else {
		// An error occurred in code somewhere else
		notifyError(
			error, {
			title: 'Application Error',
			message: `${options?.message || 'An application error has occurred'}. ${config.app.support_message}`,
		});

		// Propagate error
		if (options?.propagate)
			throw error;
	}
};


/** Options for general error wrapper */
export type ErrorWrapperOptions = AxiosErrorHandlerOptions & { onError?: (error: any, ...args: any[]) => any; finally?: () => any };

/** General purpose error wrapper function */
export function errorWrapper<T extends (...args: any) => any>(fn: T, options?: ErrorWrapperOptions) {
	// Error handler
	const handleError = (error: any, ...args: any[]) => {
		// Custom logic first
		options?.onError?.(error, ...args);

		if (error instanceof AxiosError) {
			// An error occured while communicating with server
			axiosHandler(error, options);
		}

		else {
			// An error occurred in code somewhere else
			notifyError(
				error, {
				title: 'Application Error',
				message: `${options?.message || 'An application error has occurred'}. ${config.app.support_message}`,
			});

			// Propagate error
			if (options?.propagate)
				throw error;
		}
	};

	return ((...args: any) => {
		try {
			const ret = fn(...args);
			if (ret && typeof ret.catch === "function") {
				// Async handler
				ret.catch((err: any) => handleError(err, ...args)).finally(options?.finally);
			}

			return ret;
		} catch (e) {
			// Sync handler
			handleError(e, ...args);
		}
		finally {
			options?.finally?.();
		}
	}) as T;
}


/** Wrap a swr function with an error handler */
export function swrErrorWrapper(fn: (...args: any) => Promise<any>, options?: ErrorWrapperOptions) {
	// Propagate by default (swr reverts data on error, and we want that)
	if (options && options.propagate === undefined)
		options.propagate = true;

	// Default error wrapper
	return errorWrapper(fn, options);
}