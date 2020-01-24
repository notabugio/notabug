import * as R from 'ramda';
import { ChatListing } from './ChatListing';
import { FirehoseListing } from './FirehoseListing';
import { CommentedListing } from './CommentedListing';
import { TopicListing } from './TopicListing';
import { DomainListing } from './DomainListing';
import { CommentListing } from './CommentListing';
import { SpaceListing } from './SpaceListing';
import { SpaceCommentListing } from './SpaceCommentListing';
import { InboxListing } from './InboxListing';
import { ProfileListing } from './ProfileListing';

const types = {
  ChatListing,
  FirehoseListing,
  TopicListing,
  DomainListing,
  CommentListing,
  SpaceCommentListing,
  SpaceListing,
  InboxListing,
  CommentedListing,
  ProfileListing
};

const typesArray = R.values(types);

const fromPath = (path: string) => {
  let match;

  for (let i = 0; i < typesArray.length; i++) {
    match = typesArray[i].route.match(path);
    if (match) return R.assoc('match', match, typesArray[i]);
  }
  return null;
};

export const ListingType = {
  ...types,
  types,
  fromPath
};
