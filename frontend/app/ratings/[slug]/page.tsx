import RatingHeader from '../_components/RatingHeader';
import ComingSoon from '../_components/ComingSoon';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function RatingDetailPage({ params }: Props) {
  const { slug } = await params;
  return (
    <>
      <RatingHeader />
      <ComingSoon
        title="Детальная страница модели"
        phase="Фаза 6B"
        designRef="ac-rating/design/wf-screens.jsx — DetailA"
        description={`Модель: ${slug}. Editorial long-form с параметрами, фото-галереей, плюсами/минусами и отзывами.`}
      />
    </>
  );
}
