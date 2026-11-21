import styles from "@/components/NewTenderForm.module.css";

export default function LoadingTenderForm() {
  return (
    <div className={styles.createPage} aria-busy="true">
      <h1>New tender</h1>
      <div className={styles.card} role="status">
        Loading tender details…
      </div>
    </div>
  );
}
