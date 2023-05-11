import { openContextModal } from '@mantine/modals';

import CreateChannel, { CreateChannelProps } from './CreateChannel';
import CreateDomain, { CreateDomainProps } from './CreateDomain';
import { CreateTask, CreateTaskProps, EditTask, EditTaskProps } from './CreateTask';
import {
	CreateTaskCollection, CreateTaskCollectionProps,
	EditTaskCollection, EditTaskCollectionProps
} from './CreateTaskCollection';

import UserSettings, { UserSettingsProps } from './UserSettings';


////////////////////////////////////////////////////////////
export const modals = {
	'create-channel': CreateChannel,
	'create-domain': CreateDomain,
	'create-task': CreateTask,
	'edit-task': EditTask,
	'create-task-collection': CreateTaskCollection,
	'edit-task-collection': EditTaskCollection,

	'user-settings': UserSettings,
};


/** Opens the modal to create channels */
export const openCreateChannel = (props: CreateChannelProps) => openContextModal({
	modal: 'create-channel',
	title: 'New Channel',
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
	title: props.mode === 'cycle' ? 'New Cycle' : 'New Collection',
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