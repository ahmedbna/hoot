import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Lock, PlayCircle, CheckCircle } from 'lucide-react';
import { Doc } from '@/convex/_generated/dataModel';

interface CourseCardProps {
  course: Doc<'courses'>;
}

export function CourseCard({ course }: CourseCardProps) {
  return <div>Course Card</div>;

  // const progressPercentage =
  //   (course.completedLessons / course.totalLessons) * 100;
  // const isCompleted = course.completedLessons === course.totalLessons;

  // return (
  //   <Card
  //     className={`cursor-pointer transition-all duration-200 hover:shadow-medium ${
  //       course.isUnlocked
  //         ? 'hover:scale-[1.02] border-2 hover:border-primary/50'
  //         : 'opacity-60 cursor-not-allowed'
  //     } ${isCompleted ? 'border-success bg-success/5' : ''}`}
  //     onClick={course.isUnlocked ? onClick : undefined}
  //   >
  //     <CardHeader className='pb-3'>
  //       <div className='flex items-center justify-between'>
  //         <div className='flex items-center gap-3'>
  //           <div
  //             className={`w-12 h-12 rounded-full flex items-center justify-center ${
  //               isCompleted
  //                 ? 'bg-success text-success-foreground'
  //                 : course.isUnlocked
  //                   ? 'bg-gradient-primary text-primary-foreground'
  //                   : 'bg-muted text-muted-foreground'
  //             }`}
  //           >
  //             {isCompleted ? (
  //               <CheckCircle className='w-6 h-6' />
  //             ) : course.isUnlocked ? (
  //               <PlayCircle className='w-6 h-6' />
  //             ) : (
  //               <Lock className='w-6 h-6' />
  //             )}
  //           </div>
  //           <div>
  //             <h3 className='font-bold text-lg text-foreground'>
  //               Level {course.level}
  //             </h3>
  //             <p className='text-sm text-muted-foreground'>
  //               {course.totalLessons} lessons
  //             </p>
  //           </div>
  //         </div>
  //       </div>
  //     </CardHeader>

  //     <CardContent className='space-y-4'>
  //       <div>
  //         <h4 className='font-semibold text-foreground mb-1'>{course.title}</h4>
  //         <p className='text-sm text-muted-foreground'>{course.description}</p>
  //       </div>

  //       {course.isUnlocked && (
  //         <div className='space-y-2'>
  //           <div className='flex justify-between text-sm'>
  //             <span className='text-muted-foreground'>Progress</span>
  //             <span className='font-medium text-foreground'>
  //               {course.completedLessons}/{course.totalLessons}
  //             </span>
  //           </div>
  //           <Progress
  //             value={progressPercentage}
  //             variant={isCompleted ? 'success' : 'default'}
  //             className='h-2'
  //           />
  //         </div>
  //       )}

  //       {!course.isUnlocked && (
  //         <div className='flex items-center gap-2 text-sm text-muted-foreground'>
  //           <Lock className='w-4 h-4' />
  //           <span>Requires {course.xpRequired} XP</span>
  //         </div>
  //       )}

  //       {course.isUnlocked && (
  //         <Button
  //           variant={isCompleted ? 'success' : 'default'}
  //           className='w-full'
  //           size='sm'
  //         >
  //           {isCompleted
  //             ? 'Review'
  //             : course.completedLessons > 0
  //               ? 'Continue'
  //               : 'Start'}
  //         </Button>
  //       )}
  //     </CardContent>
  //   </Card>
  // );
}
