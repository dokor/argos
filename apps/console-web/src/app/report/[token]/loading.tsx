import s from "./loading.module.scss";

export default function LoadingReport() {
  return (
    <div className={s.wrapper}>
      <div className={`${s.block} ${s.blockHero}`} />
      <div className={s.grid}>
        <div className={`${s.block} ${s.blockMd}`} />
        <div className={`${s.block} ${s.blockMd}`} />
        <div className={`${s.block} ${s.blockLg}`} />
      </div>
    </div>
  );
}
