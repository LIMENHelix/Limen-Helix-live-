(function(root){
  'use strict';
  function parts(i){var title=String(i.title||'');var at=title.lastIndexOf(' — ');return {title:at<0?title:title.slice(0,at),variant:at<0?'':title.slice(at+3)};}
  function category(i){
    var t=parts(i).title.toLowerCase();
    if(/christmas|halloween|snowman|holiday/i.test(i.title||''))return 'Seasonal';
    if(/kitchen|food storage|refrigerator|spice|seasoning|knife|meal prep/.test(t))return 'Kitchen';
    if(/\b(pets?|dogs?|cats?|kittens?)\b/.test(t))return 'Pet care';
    if(/makeup|cosmetic|beauty tool/.test(t))return 'Beauty';
    if(/organizer|storage|jewelry box|bookcase|bookcaes/.test(t))return 'Storage & organization';
    if(/phone|earbud|earphone|airpod|car key|watch/.test(t))return 'Tech & accessories';
    if(/yoga|resistance band|pilates|fitness|exercise/.test(t))return 'Fitness';
    if(/water bottle|insulated.*bottle|insulated.*cup|mug|tumbler/.test(t))return 'Drinkware';
    if(/led|lamp|light/.test(t))return 'Lighting';
    if(/shirt|hoodie|sweater|jogger|pants|dress|jacket/.test(t))return 'Clothing';
    return i.category&&i.category!=='other'?i.category:'Everyday finds';
  }
  var api={parts:parts,category:category};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RelayPresentation=api;
})(typeof window==='object'?window:this);
