import { openContextModal } from '@mantine/modals';

import CreateChannel, { CreateChannelProps } from './CreateChannel';


////////////////////////////////////////////////////////////
export const modals = {
	'create-channel': CreateChannel,
};


/** Opens the modal to create channels */
export const openCreateChannel = (props: CreateChannelProps) => openContextModal({
	modal: 'create-channel',
	title: 'Create Channel',
	innerProps: props,
  });