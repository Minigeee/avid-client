# Avid

Avid is a app developed to be a communication and productivity platform, that combines the functionality of Slack and the various tools provided by Notion. The main app structure is influenced by Slack and Discord, where each *community* is comprised of several channels that its members can access. There are several channel types, each of which serve different purposes, and will be explained in further detail below.

> *Avid was originally intended to be a professional web app, but is currently being discontinued with no plan on resuming development any time soon, so I am making this repository public to serve as reference.*
> 
> *If you have any questions about the project or are interested in seeing it continue, please contact me!*


## Introduction

> The following section is an introduction excerpt taken from the actual web app, which was intended to be an onboarding reference for new users.

As an Avid user, your account is linked to your email address, serving as a gateway to multiple profiles. This unique feature allows each profile to be a part of distinct communities and to access separate set of direct messages. The benefit here is the ease with which you can switch between profiles, each maintaining its own community memberships and conversations, and the security provided for organizations that require information and communications to remain within the organization. For instance, you might create a 'Personal' profile for social interactions and a 'Work' profile for professional engagements, ensuring a clear and organized separation of your different spheres of communication.

### Communities
In Avid, communities form the backbone of your collaborative environment. They are essentially a collection of channels, accessible via the side panel, and are open to members within a specific community. Our design philosophy for communities is centered around flexibility and user-driven structure. While you have the freedom to tailor them to your unique requirements, they can broadly be likened to an internal home website for a company or organization.

Expanding on this analogy, channels within each community are akin to individual pages on a website. These channels serve as dedicated spaces for various functions and discussions, allowing team members to engage, collaborate, and share information effectively. Whether for project management, general communication, or specific thematic discussions, channels are versatile tools to streamline your team's interaction and workflow. Let's delve deeper into the diverse types of channels available in Avid, and explore how each can be leveraged to enhance your team's productivity and collaborative experience.

### Channels
At the heart of each community are channels, designed as distinct spaces within a community to facilitate organized and efficient information management. Each channel serves a specific purpose and comes in various types:

- **Wiki**: These are editable documents perfect for sharing and presenting information in an organized manner. Our wikis support a range of features typical of markdown and rich text editors, including text styling and formatting, lists (both ordered and unordered), image embedding, code snippets, and even YouTube embeds. The very channel you're reading now is an example of the wiki channel type.

  ![Wiki](/gallery/wiki.png)

- **Calendar**: Each calendar channel functions as an independent planner, meaning events in one calendar are exclusive to it and don't appear in others. The calendar offers views by month, week, and day, incorporating most functionalities you'd expect in standard calendar applications. We're continually working to add even more features to enhance its utility.

  ![Calendar](/gallery/calendar-w.png)

- **Chat**: This channel type is akin to text-based chat rooms on various communication platforms, supporting text messages, images, and emotes. A standout feature is the ease of viewing pinned messages, which are displayed in the side panel (open by default) for effortless access. To address the common challenge of following conversations in large group chats, Avid introduces threads. These are chains of related messages, making it easier to track and engage in specific dialogues. Active threads are selectable in the side panel, making their messages highlighted in the main chat interface for clarity.

  ![Chat](/gallery/chat.png)

- **Voice & Video**: Our real-time voice and video chat rooms allow multiple users to communicate simultaneously. This channel type integrates a chat panel, encompassing all standard features of the text chat rooms (except for message pinning and threads). Users with management permissions can mute or remove participants from the room, ensuring smooth and controlled interactions.

  ![Voice and video](/gallery/rtc.png)

- **Board**: Designed for project planning and task management, the board channel offers a space to create and manage tasks and to-do lists. It allows for viewing and interacting with tasks in list or kanban views. Tasks can be grouped into collections for better management, especially useful for large projects. Objectives are special collections that set target start and end dates, helping to outline the timeline for key milestones or objectives. Tasks within these objectives represent the steps necessary for completion.

  ![Board](/gallery/board.png)

### Roles & Permissions
Avid uses a role-based permissions system, designed to be both intuitive for initial setup and capable of accommodating complex configurations. In every community, members are assigned roles, each with its distinct set of permissions defining what actions they can or cannot perform. To execute a specific action within the community, a user must possess the requisite permissions in at least one of their assigned roles. These permissions are broadly categorized into four groups:

- **Community Permissions**: These encompass permissions governing community-level actions and resources. This includes modifications to the community name and icon, invite permissions, and other community-wide settings.

- **Channel Permissions**: These are specific to channels and all their variations. They cover aspects such as channel and channel group naming and ordering, as well as unique permissions for each channel type. For instance, in chat channels, this may include permissions to delete messages posted by others.

- **Role Permissions**: These permissions are related to the creation, management, and various properties of roles within the community. They include settings for role names, badges, and the specific permissions accessible to each role.

- **Member Permissions**: These permissions enable users to perform certain actions on other community members. This includes changing a member's alias if it violates community policies, or executing member moderation actions like kicking or banning. This permission type is unique from the other types because action performer to have the necessary permissions to perform the action for all the roles assigned to the target member.

Community, role, and member permissions can be found within the community settings panel. Role and member permissions can be found within the "Child Roles" tab of the roles settings. A role can be given multiple "child roles" that the parent role will be able to manage, allowing for hierarchical structures. An example usage of this structure is assigning the "Software Developer" role as a child to the "Software Manager" role, enabling the manager to assign and oversee developer roles.

Channel permissions are accessible within the settings of channel groups. For instance, permissions for this channel can be found in the "Avid" group's settings. Currently, channel permissions apply at the group level, meaning all channels within a group share the same set of permissions. However, we are planning to introduce channel-specific permission overrides in the future to enhance flexibility.

![Roles](/gallery/roles.png)

## Technologies

This project uses NextJS with a Node backend server and Mantine as the main UI framework. The full list of external libraries can be found in the [`package.json`](https://github.com/Minigeee/avid-client/blob/main/package.json) file.

The other parts of this project can be found here:
- [server](https://github.com/Minigeee/avid-server): The API backend of the project
- [media-server](https://github.com/Minigeee/avid-media-server): The RTC media server responsible for voice and video channels