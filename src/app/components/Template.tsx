export function Template() {
  return (
    <section className="template" aria-labelledby="template-h">
      <div className="section-header">
        <span className="section-num">1</span>
        <h2 id="template-h">How every description is built</h2>
      </div>
      <div className="template-grid">
        <ol className="steps">
          <li>
            <span>
              <b>Opening paragraph.</b>{" "}Two or three sentences. The target keyword appears in the first sentence and says
              what the piece is and which room it suits.
            </span>
          </li>
          <li>
            <span>
              <b>Feature bullets.</b>{" "}Three to five short points taken only from the product data: finish, materials,
              dimensions, what&apos;s included.
            </span>
          </li>
          <li>
            <span>
              <b>Closing line.</b>{" "}How it fits a room, or the matching pieces it pairs with.
            </span>
          </li>
          <li>
            <span>
              <b>Meta title.</b>{" "}Up to 60 characters: product name and target keyword, ending in “| Surplus Furniture”.
            </span>
          </li>
          <li>
            <span>
              <b>Meta description.</b>{" "}120 to 155 characters that include the target keyword. This is the text under the
              title in Google results.
            </span>
          </li>
          <li>
            <span>
              <b>Product FAQ.</b>{" "}Three or four questions shoppers search for, answered only from your product data.
              Questions we can&apos;t answer yet are listed for you to fill in.
            </span>
          </li>
        </ol>
        <div className="rules">
          <div className="rule">
            <b>Keywords come from real searches</b>Each product gets one target keyword chosen from monthly Google.ca
            search volumes, plus up to three supporting terms.
          </div>
          <div className="rule">
            <b>Nothing is made up</b>Dimensions, materials, warranties and “made in” claims appear only when your product
            data states them. Missing details are flagged for you instead.
          </div>
          <div className="rule">
            <b>Checked against competitors</b>We compare with how Tepperman&apos;s describes a similar piece and flag specs
            they show that your listing is missing.
          </div>
          <div className="rule">
            <b>Nothing that goes out of date</b>No prices, sales, delivery promises, stock levels or competitor names.
          </div>
        </div>
      </div>
    </section>
  );
}
