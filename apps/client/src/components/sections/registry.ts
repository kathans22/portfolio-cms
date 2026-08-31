import React from 'react';
import type { SectionType } from '@portfolio/shared';
import type { SectionProps } from './types';
import {
  HeroSection,
  RichContentSection,
  StatsStripSection,
  CtaBannerSection,
  AvailabilityBannerSection,
} from './ContentSections';
import {
  ProjectListSection,
  CertificationListSection,
  SkillListSection,
  ExperienceTimelineSection,
  EducationTimelineSection,
  TestimonialListSection,
  BlogListSection,
  ChildPageListSection,
} from './CollectionSections';
import { ContactFormSection, ResumeDownloadSection } from './WidgetSections';

/**
 * Maps a stored section type to its component. Keyed by SectionType, so adding a type
 * to the shared registry without a component here is a compile error rather than a
 * blank space on a live page.
 */
export const sectionRegistry: Record<SectionType, React.FC<SectionProps>> = {
  HERO: HeroSection,
  RICH_CONTENT: RichContentSection,
  STATS_STRIP: StatsStripSection,
  CTA_BANNER: CtaBannerSection,
  AVAILABILITY_BANNER: AvailabilityBannerSection,

  PROJECT_LIST: ProjectListSection,
  CERTIFICATION_LIST: CertificationListSection,
  SKILL_LIST: SkillListSection,
  EXPERIENCE_TIMELINE: ExperienceTimelineSection,
  EDUCATION_TIMELINE: EducationTimelineSection,
  TESTIMONIAL_LIST: TestimonialListSection,
  BLOG_LIST: BlogListSection,

  CONTACT_FORM: ContactFormSection,
  RESUME_DOWNLOAD: ResumeDownloadSection,
  CHILD_PAGE_LIST: ChildPageListSection,
};
