import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell section stack">
      <p className="eyebrow">404</p>
      <h1>Esta página no existe</h1>
      <p className="lede">
        Puede que la quedada haya terminado o que el enlace esté mal copiado. Los enlaces de
        Coincide dejan de servir cuando el paseo se cancela, así que a veces es lo esperado.
      </p>
      <div className="row">
        <Link className="button button--primary" href="/">
          Volver al inicio
        </Link>
        <Link className="button button--outline" href="/parques">
          Ver los parques
        </Link>
      </div>
    </div>
  );
}
