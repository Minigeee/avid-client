import { openContextModal } from '@mantine/modals';

import TypeConfirm, { TypeConfirmProps } from './TypeConfirm';
import CreateChannel, { CreateChannelProps } from './CreateChannel';
import CreateChannelGroup, { CreateChannelGroupProps } from './CreateChannelGroup';
import CreateDomain, { CreateDomainProps } from './CreateDomain';
import { CreateTask, CreateTaskProps, EditTask, EditTaskProps } from './CreateTask';
import {
	CreateTaskCollection, CreateTaskCollectionProps,
	EditTaskCollection, EditTaskCollectionProps
} from './CreateTaskCollection';

import DomainSettings, { DomainSettingsProps } from './DomainSettings';
import ChannelGroupSettings, { ChannelGroupSettingsProps } from './ChannelGroupSettings';
import UserSettings, { UserSettingsProps } from './UserSettings';


////////////////////////////////////////////////////////////
export const modals = {
	'type-confirm': TypeConfirm,
	'create-channel': CreateChannel,
	'create-channel-group': CreateChannelGroup,
	'create-domain': CreateDomain,
	'create-task': CreateTask,
	'edit-task': EditTask,
	'create-task-collection': CreateTaskCollection,
	'edit-task-collection': EditTaskCollection,

	'domain-settings': DomainSettings,
	'channel-group-settings': ChannelGroupSettings,
	'user-settings': UserSettings,
};


/** Opens a modal that asks user to confirm their action by typing */
export const openTypeConfirm = (props: TypeConfirmProps) => openContextModal({
	modal: 'type-confirm',
	title: props.title || 'Confirm Action',
	innerProps: props,
	size: 'md',
});


/** Opens the modal to create channels */
export const openCreateChannel = (props: CreateChannelProps) => openContextModal({
	modal: 'create-channel',
	title: 'New Channel',
	innerProps: props,
});

/** Opens the modal to create channel groups */
export const openCreateChannelGroup = (props: CreateChannelGroupProps) => openContextModal({
	modal: 'create-channel-group',
	title: 'New Channel Group',
	innerProps: props,
});


/** Opens the modal to create domains */
export const openCreateDomain = (props: CreateDomainProps) => openContextModal({
	modal: 'create-domain',
	withCloseButton: false,
	innerProps: props,
	styles: (theme) => ({
		body: { backgroundColor: theme.colors.dark[5] }
	})
});


/** Opens the modal to create task */
export const openCreateTask = (props: CreateTaskProps) => openContextModal({
	modal: 'create-task',
	title: 'New Task',
	innerProps: props,
	size: 'xl',
});


/** Opens the modal to edit task */
export const openEditTask = (props: EditTaskProps) => openContextModal({
	modal: 'edit-task',
	title: `${props.board_prefix}-${props.task.sid}`,
	innerProps: props,
	size: '120ch',
});


/** Opens the modal to create task collection */
export const openCreateTaskCollection = (props: CreateTaskCollectionProps) => openContextModal({
	modal: 'create-task-collection',
	title: props.mode === 'objective' ? 'New Objective' : 'New Collection',
	innerProps: props,
	size: 'lg',
});


/** Opens the modal to edit task collection */
export const openEditTaskCollection = (props: EditTaskCollectionProps) => openContextModal({
	modal: 'edit-task-collection',
	title: `Edit ${props.collection.name}`,
	innerProps: props,
	size: 'lg',
});


/** Open domain settings modal */
export const openDomainSettings = (props: DomainSettingsProps) => openContextModal({
	modal: 'domain-settings',
	withCloseButton: false,
	innerProps: props,
	size: '160ch',
	styles: {
		body: {
			padding: 0,
			height: '120ch',
			maxHeight: '90vh',
		},
	},
	closeOnClickOutside: false,
	closeOnEscape: false,
});

/** Open domain settings modal */
export const openChannelGroupSettings = (props: ChannelGroupSettingsProps) => openContextModal({
	modal: 'channel-group-settings',
	withCloseButton: false,
	innerProps: props,
	size: '160ch',
	styles: {
		body: {
			padding: 0,
			height: '120ch',
			maxHeight: '90vh',
		},
	},
	closeOnClickOutside: false,
	closeOnEscape: false,
});

/** Open user settings modal */
export const openUserSettings = (props: UserSettingsProps) => openContextModal({
	modal: 'user-settings',
	withCloseButton: false,
	innerProps: props,
	size: '160ch',
	styles: {
		body: {
			padding: 0,
			height: '120ch',
			maxHeight: '90vh',
		},
	},
});


export { useImageModal } from './ImageModal';